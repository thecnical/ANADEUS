import { createToolRunnerExecutor, runPhase } from "../../orchestrator/orchestrator.js";
import { savePhaseData } from "../../orchestrator/phase_manager.js";
import { runWithConcurrency, prioritizeTarget } from "../../src/core/performance/scheduler.js";
import {
  buildReconPayload,
  buildReconTasks,
  dedupeStrings,
  findTaskResult,
  writeReconLog,
} from "./recon_utils.js";

export async function runRecon(target, mode = "deep", options = {}) {
  const tasks = options.tasksOverride || buildReconTasks(mode);
  const baseExecutor = options.executeTool || createToolRunnerExecutor(options);

  await writeReconLog("recon_started", { target, mode }, options);

  const phaseResult = await runPhase(target, "recon", tasks, {
    ...options,
    requirePreviousPhase: false,
    executeTool: async (toolName, originalTarget, toolOptions = {}, toolInput = {}) =>
      executeReconTool({
        toolName,
        target: originalTarget,
        toolOptions,
        toolInput,
      executeTool: baseExecutor,
      options,
    }),
  });

  const reconPayload = buildReconPayload(target, mode, phaseResult);
  await savePhaseData(target, "recon", reconPayload, options);

  await writeReconLog("recon_completed", {
    target,
    mode,
    status: reconPayload.status,
    subdomains: reconPayload.subdomains.length,
    alive_hosts: reconPayload.alive_hosts.length,
    technologies: reconPayload.technologies.length,
    endpoints: reconPayload.endpoints.length,
  }, options);

  return reconPayload;
}

export async function run_recon(target, mode = "deep", options = {}) {
  return runRecon(target, mode, options);
}

async function executeReconTool({ toolName, target, toolOptions, toolInput, executeTool, options }) {
  const taskName = toolInput?.task?.name;

  if (taskName === "subdomain_enumeration") {
    return executeTool(toolName, target, toolOptions, toolInput);
  }

  const discoveredHosts = getDiscoveredHosts(toolInput, target);

  if (taskName === "alive_host_detection") {
    return runAcrossTargets(discoveredHosts, toolName, toolOptions, executeTool, {
      requireSuccess: true,
      options,
      phaseTarget: toolInput?.target || target,
      toolInput,
    });
  }

  if (taskName === "technology_detection") {
    const aliveHosts = getAliveHosts(toolInput, discoveredHosts);
    return runAcrossTargets(aliveHosts, toolName, toolOptions, executeTool, {
      requireSuccess: true,
      options,
      phaseTarget: toolInput?.target || target,
      toolInput,
    });
  }

  if (taskName === "endpoint_discovery") {
    const aliveHosts = getAliveHosts(toolInput, []);
    if (aliveHosts.length === 0) {
      return buildEmptyReconResult(toolName, "No alive hosts were available for endpoint discovery.");
    }
    return runAcrossTargets(aliveHosts, toolName, toolOptions, executeTool, {
      requireSuccess: false,
      options,
      phaseTarget: toolInput?.target || target,
      toolInput,
    });
  }

  return executeTool(toolName, target, toolOptions, toolInput);
}

function getDiscoveredHosts(toolInput, target) {
  const subdomainTask = findTaskResult({ tasks: toolInput?.context?.previousTaskResults || [] }, "subdomain_enumeration");
  const entries = [];

  for (const attempt of subdomainTask?.attempts || []) {
    for (const value of attempt.result?.data?.subdomains || []) {
      entries.push(value);
    }
  }

  return dedupeStrings(entries.length > 0 ? entries : [target]);
}

function getAliveHosts(toolInput, fallbackHosts) {
  const aliveTask = findTaskResult({ tasks: toolInput?.context?.previousTaskResults || [] }, "alive_host_detection");
  const entries = [];

  for (const attempt of aliveTask?.attempts || []) {
    for (const host of attempt.result?.data?.alive_hosts || []) {
      entries.push(host.url || host.host);
    }
  }

  return dedupeStrings(entries.length > 0 ? entries : fallbackHosts);
}

async function runAcrossTargets(targets, toolName, toolOptions, executeTool, {
  requireSuccess,
  options = {},
  phaseTarget = null,
  toolInput = {},
}) {
  const normalizedTargets = dedupeStrings(targets);
  const concurrency = Math.max(1, options.reconConcurrency || 4);
  const attemptResults = await runWithConcurrency(
    normalizedTargets,
    async (item) => executeTool(toolName, item, toolOptions, {
      ...toolInput,
      target: phaseTarget || toolInput?.target || item,
      batchTarget: item,
    }),
    {
      concurrency,
      prioritize: prioritizeTarget,
    },
  );
  const anySuccess = attemptResults.some((result) => result.status === "success");

  if (attemptResults.length === 0) {
    return {
      tool: toolName,
      target: "",
      status: "error",
      data: {},
      raw_output: "",
      execution_time: 0,
      error_type: "no_targets",
      message: "No targets were available for this recon step.",
    };
  }

  if (requireSuccess && !anySuccess) {
    const firstFailure = attemptResults[0];
    return {
      tool: toolName,
      target: firstFailure.target,
      status: "error",
      data: {},
      raw_output: attemptResults.map((result) => result.raw_output).filter(Boolean).join("\n"),
      execution_time: attemptResults.reduce((sum, result) => sum + (result.execution_time || 0), 0),
      error_type: firstFailure.error_type || "tool_error",
      message: firstFailure.message || "All recon targets failed for this tool.",
    };
  }

  return mergeBatchResults(toolName, attemptResults);
}

function mergeBatchResults(toolName, results) {
  const merged = {
    tool: toolName,
    target: results[0]?.target || "",
    status: results.some((result) => result.status === "success") ? "success" : "error",
    data: {},
    raw_output: results.map((result) => result.raw_output).filter(Boolean).join("\n"),
    execution_time: Number(results.reduce((sum, result) => sum + (result.execution_time || 0), 0).toFixed(4)),
  };

  if (toolName === "httpx" || toolName === "webprobe") {
    const alive_hosts = [];
    const technologies = [];
    for (const result of results) {
      alive_hosts.push(...(result.data?.alive_hosts || []));
      technologies.push(...(result.data?.technologies || []));
    }
    merged.data = {
      alive_hosts,
      technologies: dedupeStrings(technologies),
      count: alive_hosts.length,
    };
    return merged;
  }

  if (toolName === "whatweb") {
    const findings = [];
    const identified_technologies = [];
    for (const result of results) {
      findings.push(...(result.data?.findings || []));
      identified_technologies.push(...(result.data?.identified_technologies || []));
    }
    merged.data = {
      findings,
      technologies: dedupeStrings(identified_technologies),
      identified_technologies: dedupeStrings(identified_technologies),
    };
    return merged;
  }

  if (toolName === "ffuf" || toolName === "routeprobe") {
    const matches = [];
    const paths = [];
    const statusCodes = [];
    for (const result of results) {
      matches.push(...(result.data?.matches || []));
      paths.push(...(result.data?.paths || []));
      statusCodes.push(...(result.data?.status_codes || []));
    }
    merged.data = {
      matches,
      paths: dedupeStrings(paths),
      status_codes: [...new Set(statusCodes)].sort((left, right) => left - right),
      count: matches.length,
    };
    return merged;
  }

  return {
    ...merged,
    data: results[0]?.data || {},
  };
}

function buildEmptyReconResult(toolName, message) {
  return {
    tool: toolName,
    target: "",
    status: "success",
    data: toolName === "whatweb"
      ? { findings: [], technologies: [], identified_technologies: [] }
      : { matches: [], paths: [], status_codes: [], count: 0 },
    raw_output: "",
    execution_time: 0,
    message,
  };
}

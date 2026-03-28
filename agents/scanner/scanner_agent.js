import { createToolRunnerExecutor, runPhase } from "../../orchestrator/orchestrator.js";
import { loadPhaseData, savePhaseData } from "../../orchestrator/phase_manager.js";
import { prioritizeTarget, runWithConcurrency } from "../../src/core/performance/scheduler.js";
import {
  buildDirectoryTargets,
  buildScannerPayload,
  buildScannerTasks,
  dedupeStrings,
  extractReconHosts,
  findTaskResult,
  hasWebSurface,
  writeScannerLog,
} from "./scanner_utils.js";

export async function runScanner(target, mode = "deep", options = {}) {
  const reconData = await loadPhaseData(target, "recon", options);
  if (!reconData) {
    return {
      target,
      mode,
      phase: "scan",
      status: "error",
      error_type: "missing_recon_data",
      message: `Recon data was not found for target '${target}'. Run recon first.`,
    };
  }

  const tasks = options.tasksOverride || buildScannerTasks(mode);
  const baseExecutor = options.executeTool || createToolRunnerExecutor(options);

  await writeScannerLog("scan_started", { target, mode }, options);

  const phaseResult = await runPhase(target, "scan", tasks, {
    ...options,
    executeTool: async (toolName, originalTarget, toolOptions = {}, toolInput = {}) =>
      executeScannerTool({
        toolName,
        target: originalTarget,
        toolOptions,
        toolInput,
        executeTool: baseExecutor,
        reconData,
        options,
      }),
  });

  let scanPayload = buildScannerPayload(target, mode, reconData, phaseResult);

  let hasData = scanPayload.open_ports.length > 0 || scanPayload.directories.length > 0 || scanPayload.endpoints.length > 0;

  if (!hasData) {
    await writeScannerLog("scan_retrying_alternate", { target, mode }, options);
    
    // 1. Retry with alternate tools
    const alternateTasks = [
      {
        name: "port_service_scan",
        tools: [
          {
            name: "socketprobe",
            options: mode === "light" ? { top_ports: 100, timeout: 4 } : { top_ports: 1000, timeout: 4 },
          },
        ],
        retries: 1,
        continueOnFailure: true,
      },
      {
        name: "directory_endpoint_discovery",
        tools: [
          {
            name: "dirsearch",
            options: {
              wordlist: "/usr/share/wordlists/dirb/common.txt",
              status_codes: "200,204,301,302,307,401,403",
            },
          },
        ],
        retries: 1,
        continueOnFailure: true,
      },
    ];

    const retryResult = await runPhase(target, "scan", alternateTasks, {
      ...options,
      force: true,
      executeTool: async (toolName, originalTarget, toolOptions = {}, toolInput = {}) =>
        executeScannerTool({
          toolName,
          target: originalTarget,
          toolOptions,
          toolInput,
          executeTool: baseExecutor,
          reconData,
          options,
        }),
    });

    scanPayload = buildScannerPayload(target, mode, reconData, retryResult);
    hasData = scanPayload.open_ports.length > 0 || scanPayload.directories.length > 0 || scanPayload.endpoints.length > 0;
  }

  // 2. If still empty: mark: "scan_mode": "degraded", "note": "limited data available".
  if (!hasData) {
    scanPayload.scan_mode = "degraded";
    scanPayload.note = "limited data available";
    scanPayload.status = "error"; // System must NOT silently succeed

    // Synchronize to phase state as an error
    await import("../../orchestrator/phase_manager.js").then((m) => m.updatePhaseState(target, "scan", { status: "error" }, options));
  }

  await savePhaseData(target, "scan", scanPayload, options);

  await writeScannerLog("scan_completed", {
    target,
    mode,
    status: scanPayload.status,
    hosts_scanned: scanPayload.hosts_scanned.length,
    open_ports: scanPayload.open_ports.length,
    directories: scanPayload.directories.length,
    endpoints: scanPayload.endpoints.length,
    findings: scanPayload.nikto_findings.length,
  }, options);

  return scanPayload;
}

export async function run_scanner(target, mode = "deep", options = {}) {
  return runScanner(target, mode, options);
}

async function executeScannerTool({ toolName, target, toolOptions, toolInput, executeTool, reconData, options }) {
  const taskName = toolInput?.task?.name;

  if (taskName === "port_service_scan") {
    const hosts = extractReconHosts(reconData, target);
    return runAcrossTargets(hosts, toolName, toolOptions, executeTool, {
      requireSuccess: false,
      options,
      phaseTarget: toolInput?.target || target,
      toolInput,
    });
  }

  if (!hasWebSurface(reconData, { tasks: toolInput?.context?.previousTaskResults || [] })) {
    return {
      tool: toolName,
      target,
      status: "success",
      data: taskName === "web_server_scan"
        ? { findings: [], notes: [] }
        : { matches: [], directories: [], endpoints: [], count: 0 },
      raw_output: "",
      execution_time: 0,
    };
  }

  if (taskName === "directory_endpoint_discovery") {
    const targets = buildDirectoryTargets(reconData, { tasks: toolInput?.context?.previousTaskResults || [] }, target);
    return runAcrossTargets(targets, toolName, toolOptions, executeTool, {
      requireSuccess: false,
      options,
      phaseTarget: toolInput?.target || target,
      toolInput,
    });
  }

  if (taskName === "web_server_scan") {
    const targets = getWebTargets(reconData, target);
    return runAcrossTargets(targets, toolName, toolOptions, executeTool, {
      requireSuccess: false,
      options,
      phaseTarget: toolInput?.target || target,
      toolInput,
    });
  }

  return executeTool(toolName, target, toolOptions, toolInput);
}

function getWebTargets(reconData, target) {
  return dedupeStrings(extractReconHosts(reconData, target));
}

async function runAcrossTargets(targets, toolName, toolOptions, executeTool, {
  requireSuccess,
  options = {},
  phaseTarget = null,
  toolInput = {},
}) {
  const normalizedTargets = dedupeStrings(targets);
  const concurrency = Math.max(1, options.scanConcurrency || 4);
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
      message: "No targets were available for this scan step.",
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
      execution_time: Number(attemptResults.reduce((sum, result) => sum + (result.execution_time || 0), 0).toFixed(4)),
      error_type: firstFailure.error_type || "tool_error",
      message: firstFailure.message || "All scan targets failed for this tool.",
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

  if (toolName === "nmap" || toolName === "socketprobe") {
    const openPorts = [];
    const services = [];
    const portDetails = [];
    for (const result of results) {
      openPorts.push(...(result.data?.open_ports || []));
      services.push(...(result.data?.services || []));
      portDetails.push(...(result.data?.port_details || []));
    }
    merged.data = {
      open_ports: [...new Set(openPorts)].sort((left, right) => left - right),
      services: dedupeStrings(services),
      port_details: portDetails,
    };
    return merged;
  }

  if (toolName === "ffuf" || toolName === "dirsearch" || toolName === "feroxbuster" || toolName === "routeprobe") {
    const matches = [];
    const directories = [];
    for (const result of results) {
      matches.push(...(result.data?.matches || []));
      directories.push(...(result.data?.directories || result.data?.paths || []));
    }
    merged.data = {
      matches,
      directories: dedupeStrings(directories),
      count: matches.length,
    };
    return merged;
  }

  if (toolName === "nikto") {
    const findings = [];
    const notes = [];
    for (const result of results) {
      findings.push(...(result.data?.findings || []));
      notes.push(...(result.data?.notes || []));
    }
    merged.data = {
      findings,
      notes: dedupeStrings(notes),
      count: findings.length,
    };
    return merged;
  }

  return {
    ...merged,
    data: results[0]?.data || {},
  };
}

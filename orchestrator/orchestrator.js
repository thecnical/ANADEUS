import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOrchestratorLogger } from "./logger.js";
import {
  ensureWorkspaceStructure,
  getPhaseFilePath,
  getPreviousPhase,
  loadMeta,
  loadPhaseData,
  markPhaseComplete,
  savePhaseData,
  summarizeTaskResults,
  updatePhaseState,
  validatePhase,
} from "./phase_manager.js";
import { executeTasks } from "./task_engine.js";
import { buildPerformanceMetrics, executeOptimizedTool, writePerformanceMetrics } from "../src/core/performance/optimizer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_TOOL_RUNNER_PATH = path.join(REPO_ROOT, "tool_runner.py");

export async function runPhase(target, phase, tasks, options = {}) {
  const logger = options.logger || createOrchestratorLogger(options);
  const normalizedPhase = validatePhase(phase);

  await ensureWorkspaceStructure(target, options);

  const previousPhase = getPreviousPhase(normalizedPhase);
  const previousPhaseData = previousPhase ? await loadPhaseData(target, previousPhase, options) : null;

  if (previousPhase && !previousPhaseData && options.requirePreviousPhase !== false) {
    const errorResult = buildErrorResult(target, normalizedPhase, "missing_phase_data", `Missing required data from previous phase '${previousPhase}'.`);
    await logger.error("phase_failed", { target, phase: normalizedPhase, errorType: errorResult.error_type });
    return errorResult;
  }

  let existingPhaseData = await loadPhaseData(target, normalizedPhase, options);
  const meta = await loadMeta(target, options);
  const startedAt = new Date().toISOString();

  await logger.info("phase_started", { target, phase: normalizedPhase });
  await updatePhaseState(target, normalizedPhase, {
    status: "running",
    startedAt,
    previousPhase,
  }, options);

  try {
    const executeTool = options.executeTool || createToolRunnerExecutor(options);
    const taskExecution = await executeTasks({
      target,
      phase: normalizedPhase,
      tasks,
      context: {
        previousPhase,
        previousPhaseData,
        meta,
      },
      existingPhaseData,
      executeTool,
      logger,
      force: Boolean(options.force),
    });

    existingPhaseData = existingPhaseData || { tasks: [] };
    const summary = summarizeTaskResults(taskExecution.taskResults);
    const performance = buildPerformanceMetrics(taskExecution.taskResults);
    const phaseStatus = taskExecution.status === "error"
      ? "error"
      : summary.failedTasks > 0
        ? "partial"
        : "success";

    const phasePayload = {
      target,
      phase: normalizedPhase,
      status: phaseStatus,
      startedAt,
      completedAt: new Date().toISOString(),
      previousPhase,
      previousPhaseFile: previousPhase ? getPhaseFilePath(target, previousPhase, options) : null,
      context: {
        previousPhaseData,
      },
      tasks: taskExecution.taskResults,
      summary,
      performance,
    };

    await savePhaseData(target, normalizedPhase, phasePayload, options);
    await updatePhaseState(target, normalizedPhase, {
      status: phaseStatus,
      completedAt: phasePayload.completedAt,
      summary,
    }, options);
    
    // SINGLE SOURCE OF TRUTH - ALL completion updates through markPhaseComplete
    if (phaseStatus === "success" || phaseStatus === "partial") {
      await markPhaseComplete(target, normalizedPhase, options);
    }
    
    await logger.info("phase_completed", {
      target,
      phase: normalizedPhase,
      status: phaseStatus,
      progress: summary.progress,
    });
    await writePerformanceMetrics(normalizedPhase, target, performance, options);

    return phasePayload;
  } catch (error) {
    const errorResult = buildErrorResult(target, normalizedPhase, "orchestrator_error", error.message);
    await updatePhaseState(target, normalizedPhase, {
      status: "error",
      completedAt: new Date().toISOString(),
      error: error.message,
    }, options);
    await logger.error("phase_failed", {
      target,
      phase: normalizedPhase,
      errorType: errorResult.error_type,
      message: error.message,
    });
    return errorResult;
  }
}

export function createToolRunnerExecutor(options = {}) {
  const pythonBinary = options.pythonBinary || "python";
  const runnerPath = options.toolRunnerPath || DEFAULT_TOOL_RUNNER_PATH;

  return async function executeTool(toolName, target, toolOptions = {}, toolInput = {}) {
    return executeOptimizedTool({
      execute: async (optimizedToolName, optimizedTarget, optimizedOptions, _toolInput, executionOptions = {}) => {
        const args = [
          runnerPath,
          optimizedToolName,
          optimizedTarget,
          "--options",
          JSON.stringify(optimizedOptions),
        ];

        return spawnToolRunner(pythonBinary, args, {
          ...options,
          integrationTimeoutMs: executionOptions.timeoutMs || options.integrationTimeoutMs,
        });
      },
      toolName,
      phaseTarget: toolInput?.target || target,
      toolTarget: target,
      toolOptions,
      toolInput,
      options,
    });
  };
}

export async function spawnToolRunner(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || REPO_ROOT,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timeoutMs = options.integrationTimeoutMs || 90_000;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        tool: args[1] || "unknown",
        target: args[2] || "",
        status: "error",
        data: {},
        raw_output: stderr || stdout,
        execution_time: 0,
        error_type: "integration_error",
        message: error.message,
      });
    });

    child.on("close", () => {
      clearTimeout(timer);

      if (timedOut) {
        resolve({
          tool: args[1] || "unknown",
          target: args[2] || "",
          status: "error",
          data: {},
          raw_output: stdout || stderr,
          execution_time: 0,
          error_type: "integration_timeout",
          message: `Tool runner exceeded integration timeout of ${timeoutMs}ms.`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(validateToolRunnerResponse(parsed, args));
      } catch (error) {
        resolve({
          tool: args[1] || "unknown",
          target: args[2] || "",
          status: "error",
          data: {},
          raw_output: stdout || stderr,
          execution_time: 0,
          error_type: "invalid_runner_response",
          message: `Failed to parse tool runner JSON response: ${error.message}`,
        });
      }
    });
  });
}

function validateToolRunnerResponse(response, args) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Tool runner response must be a JSON object.");
  }

  const normalized = {
    tool: typeof response.tool === "string" ? response.tool : args[1] || "unknown",
    target: typeof response.target === "string" ? response.target : args[2] || "",
    status: response.status,
    data: response.data && typeof response.data === "object" ? response.data : {},
    raw_output: typeof response.raw_output === "string" ? response.raw_output : "",
    execution_time: typeof response.execution_time === "number" ? response.execution_time : 0,
  };

  if (!["success", "error", "partial"].includes(normalized.status)) {
    throw new Error("Tool runner response has an invalid status value.");
  }

  if (normalized.status === "error") {
    normalized.error_type = typeof response.error_type === "string" ? response.error_type : "tool_error";
    normalized.message = typeof response.message === "string" ? response.message : "Tool runner returned an error.";
  }

  return normalized;
}

function buildErrorResult(target, phase, errorType, message) {
  return {
    target,
    phase,
    status: "error",
    error_type: errorType,
    message,
    tasks: [],
    summary: {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      skippedTasks: 0,
      progress: 0,
    },
  };
}

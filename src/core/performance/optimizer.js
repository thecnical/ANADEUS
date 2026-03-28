import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCachedToolResult, setCachedToolResult } from "./cache_manager.js";

const TOOL_OPTION_SCHEMA = {
  amass: ["passive", "brute"],
  assetfinder: [],
  dirsearch: ["wordlist", "extensions", "threads", "status_codes"],
  feroxbuster: ["wordlist", "threads", "status_codes"],
  ffuf: ["url", "wordlist", "method", "headers", "match_codes", "filter_codes", "rate", "auto_fuzz_path"],
  httpx: ["follow_redirects", "status_code", "threads", "title"],
  nikto: ["timeout", "tuning"],
  nmap: ["ports", "service_version", "top_ports", "scripts", "timing_template"],
  routeprobe: ["timeout", "paths"],
  socketprobe: ["ports", "timeout", "top_ports"],
  subfinder: ["all", "recursive", "max_time"],
  webprobe: ["timeout", "port"],
  whatweb: ["aggression"],
};

export function sanitizeOptions(toolName, options = {}) {
  const allowed = TOOL_OPTION_SCHEMA[String(toolName || "").toLowerCase()] || [];
  return Object.fromEntries(
    Object.entries(options || {}).filter(([key]) => allowed.includes(key)),
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_FILE = path.resolve(__dirname, "..", "..", "..", "logs", "performance.log");

export function optimizeToolExecution(toolName, toolOptions = {}, toolInput = {}, options = {}) {
  const normalizedTool = String(toolName || "").toLowerCase();
  const optimizedOptions = {
    ...toolOptions,
  };

  if (normalizedTool === "httpx") {
    optimizedOptions.threads = clampNumber(optimizedOptions.threads ?? options.defaultHttpThreads ?? 50, 10, 100);
    optimizedOptions.timeout = optimizedOptions.timeout ?? 20;
  }

  if (normalizedTool === "ffuf" || normalizedTool === "feroxbuster" || normalizedTool === "dirsearch") {
    optimizedOptions.threads = clampNumber(optimizedOptions.threads ?? options.defaultWebThreads ?? 20, 5, 50);
    optimizedOptions.timeout = optimizedOptions.timeout ?? 30;
  }

  if (normalizedTool === "nmap") {
    optimizedOptions.top_ports = optimizedOptions.top_ports ?? 1000;
    optimizedOptions.timeout = optimizedOptions.timeout ?? 90;
  }

  const timeoutMs = resolveTimeoutMs(normalizedTool, optimizedOptions, options);

  return {
    toolName: normalizedTool,
    toolOptions: optimizedOptions,
    timeoutMs,
    shouldCache: shouldCacheTool(normalizedTool, toolInput, options),
  };
}

export async function executeOptimizedTool({
  execute,
  toolName,
  phaseTarget,
  toolTarget,
  toolOptions = {},
  toolInput = {},
  options = {},
}) {
  const optimized = optimizeToolExecution(toolName, toolOptions, toolInput, options);

  if (optimized.shouldCache && !options.force) {
    const cached = await getCachedToolResult(phaseTarget, optimized.toolName, toolTarget, optimized.toolOptions, options);
    if (cached) {
      await writePerformanceLog("tool_cache_hit", {
        phaseTarget,
        toolName: optimized.toolName,
        toolTarget,
      }, options);
      return {
        ...cached,
        cached: true,
      };
    }
  }

  const startedAt = Date.now();
  
  // STRICT TOOL-SPECIFIC OPTION SANITIZATION
  const finalOptions = sanitizeOptions(optimized.toolName, optimized.toolOptions);

  const result = await execute(optimized.toolName, toolTarget, finalOptions, toolInput, {
    timeoutMs: optimized.timeoutMs,
  });
  const durationMs = Date.now() - startedAt;

  await writePerformanceLog("tool_executed", {
    phaseTarget,
    toolName: optimized.toolName,
    toolTarget,
    status: result.status,
    durationMs,
  }, options);

  if (optimized.shouldCache && result.status === "success") {
    await setCachedToolResult(phaseTarget, optimized.toolName, toolTarget, optimized.toolOptions, result, options);
  }

  return result;
}

export async function writePerformanceMetrics(phase, target, metrics = {}, options = {}) {
  return writePerformanceLog("phase_metrics", {
    phase,
    target,
    ...metrics,
  }, options);
}

export function buildPerformanceMetrics(taskResults = []) {
  const attempts = taskResults.flatMap((task) => task.attempts || []);
  const toolMetrics = attempts.map((attempt) => ({
    tool: attempt.tool,
    execution_time: attempt.result?.execution_time || 0,
    cached: Boolean(attempt.result?.cached),
  }));

  return {
    taskCount: taskResults.length,
    toolExecutions: toolMetrics.length,
    cacheHits: toolMetrics.filter((item) => item.cached).length,
    totalExecutionTime: Number(toolMetrics.reduce((sum, item) => sum + item.execution_time, 0).toFixed(4)),
  };
}

function shouldCacheTool(toolName, toolInput, options) {
  if (options.disableCache) {
    return false;
  }

  const taskName = toolInput?.task?.name || "";
  if (taskName.includes("exploit") || taskName.includes("validation")) {
    return false;
  }

  return [
    "subfinder",
    "amass",
    "assetfinder",
    "httpx",
    "whatweb",
    "nmap",
    "ffuf",
    "dirsearch",
    "feroxbuster",
    "nikto",
    "webprobe",
    "socketprobe",
    "routeprobe",
  ].includes(toolName);
}

function resolveTimeoutMs(toolName, optimizedOptions, options) {
  const requestedTimeout = optimizedOptions.timeout || options.integrationTimeoutSeconds;
  if (requestedTimeout) {
    return Number(requestedTimeout) * 1000;
  }

  if (toolName === "nmap") {
    return 120_000;
  }

  if (toolName === "nikto") {
    return 90_000;
  }

  return options.integrationTimeoutMs || 60_000;
}

async function writePerformanceLog(event, meta = {}, options = {}) {
  const logFile = options.performanceLogFile || DEFAULT_LOG_FILE;
  await mkdir(path.dirname(logFile), { recursive: true });
  const suffix = Object.keys(meta).length
    ? ` ${Object.entries(meta).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ")}`
    : "";
  await appendFile(logFile, `${new Date().toISOString()} ${event}${suffix}\n`, "utf8");
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeIntegratedPhase } from "../../services/integration-service.js";
import { validatePhaseOutput } from "./validator.js";
import { TEST_PHASES } from "./rules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_FILE = path.resolve(__dirname, "..", "..", "..", "logs", "testing.log");

export async function runTest(phase, target, options = {}) {
  const normalizedPhase = String(phase || "").trim().toLowerCase();

  await writeTestingLog("test_started", {
    phase: normalizedPhase,
    target,
  }, options);

  let executionStatus = "success";
  try {
    const mode = normalizedPhase === "exploit" ? "safe" : "deep";
    await executeIntegratedPhase({
      phase: normalizedPhase,
      target,
      mode,
      options,
    });
  } catch (error) {
    executionStatus = "error";
    await writeTestingLog("phase_execution_failed", {
      phase: normalizedPhase,
      target,
      message: error.message,
    }, options);
  }

  const validation = await validatePhaseOutput(normalizedPhase, target, options);
  const result = {
    phase: normalizedPhase,
    execution: executionStatus,
    status: toSummaryStatus(validation.status),
    issue: validation.issue,
    artifactPath: validation.artifactPath,
  };

  await writeTestingLog("test_completed", {
    phase: normalizedPhase,
    target,
    execution: executionStatus,
    status: result.status,
    issue: result.issue,
  }, options);

  return result;
}

export async function runAllTests(target, options = {}) {
  const results = [];

  for (const phase of TEST_PHASES) {
    try {
      const result = await runTest(phase, target, options);
      results.push(result);
    } catch (error) {
      results.push({
        phase,
        execution: "error",
        status: "fail",
        issue: error.message,
        artifactPath: null,
      });
      await writeTestingLog("test_crashed", {
        phase,
        target,
        message: error.message,
      }, options);
    }
  }

  return {
    target,
    type: "test",
    status: results.some((item) => item.status === "fail")
      ? "fail"
      : results.some((item) => item.status === "warning")
        ? "warning"
        : "pass",
    results,
    summary: {
      recon: findResultStatus(results, "recon"),
      scan: findResultStatus(results, "scan"),
      analysis: findResultStatus(results, "analysis"),
      exploit: findResultStatus(results, "exploit"),
      report: findResultStatus(results, "report"),
    },
    progress: results.map((result) => ({
      phase: result.phase,
      status: toProgressStatus(result.status),
    })),
  };
}

export async function run_test(phase, target, options = {}) {
  return runTest(phase, target, options);
}

async function writeTestingLog(event, meta = {}, options = {}) {
  const logFile = options.testingLogFile || DEFAULT_LOG_FILE;
  await mkdir(path.dirname(logFile), { recursive: true });
  const suffix = Object.keys(meta).length
    ? ` ${Object.entries(meta).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ")}`
    : "";
  await appendFile(logFile, `${new Date().toISOString()} ${event}${suffix}\n`, "utf8");
}

function toSummaryStatus(status) {
  if (status === "pass") {
    return "pass";
  }

  if (status === "warning") {
    return "warning";
  }

  return "fail";
}

function toProgressStatus(status) {
  if (status === "pass") {
    return "completed";
  }

  if (status === "warning") {
    return "warning";
  }

  return "failed";
}

function findResultStatus(results, phase) {
  return results.find((item) => item.phase === phase)?.status || "fail";
}

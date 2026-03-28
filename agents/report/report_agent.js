import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureWorkspaceStructure,
  getPhaseDirectory,
  loadPhaseData,
  savePhaseData,
  updatePhaseState,
  markPhaseComplete,
} from "../../orchestrator/phase_manager.js";
import { buildImpactPayload, buildReportEntry } from "./impact_engine.js";
import { renderFinalReport } from "./formatter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_FILE = path.resolve(__dirname, "..", "..", "logs", "report.log");

export async function runReport(target, options = {}) {
  await ensureWorkspaceStructure(target, options);

  const exploitData = await loadPhaseData(target, "exploit", options);
  if (!exploitData) {
    const errorResult = {
      target,
      phase: "report",
      status: "error",
      error_type: "missing_exploit_data",
      message: `Exploit data was not found for target '${target}'. Run exploit first.`,
    };
    await updatePhaseState(target, "report", {
      status: "error",
      completedAt: new Date().toISOString(),
      error: errorResult.message,
    }, options);
    await writeReportLog("report_failed", {
      target,
      error_type: errorResult.error_type,
      message: errorResult.message,
    }, options);
    return errorResult;
  }

  await writeReportLog("report_started", { target }, options);
  await updatePhaseState(target, "report", {
    status: "running",
    startedAt: new Date().toISOString(),
  }, options);

  try {
    const warnings = [];
    const confirmedFindings = Array.isArray(exploitData.confirmed_vulnerabilities)
      ? exploitData.confirmed_vulnerabilities
      : [];
    const reports = confirmedFindings.map((finding) => buildReportEntry(finding));
    const pocMarkdown = await loadPocMarkdown(target, exploitData, warnings, options);
    const impactPayload = buildImpactPayload(target, reports, warnings);
    const aiSummary = await loadAiReportSummary(target, impactPayload, pocMarkdown, options);
    if (aiSummary) {
      impactPayload.ai_summary = aiSummary;
    }
    const finalReport = renderFinalReport(target, impactPayload, {
      pocMarkdown,
    });

    const reportDirectory = getPhaseDirectory(target, "report", options);
    const impactPath = path.join(reportDirectory, "impact.json");
    const finalReportPath = path.join(reportDirectory, "final_report.md");
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(impactPath, `${JSON.stringify(impactPayload, null, 2)}\n`, "utf8");
    await writeFile(finalReportPath, `${finalReport}\n`, "utf8");

    const reportPayload = {
      ...impactPayload,
      artifacts: {
        impact_json: impactPath,
        final_report_md: finalReportPath,
      },
    };

    await savePhaseData(target, "report", reportPayload, options);
    await updatePhaseState(target, "impact", {
      status: "success",
      completedAt: new Date().toISOString(),
      summary: impactPayload.summary,
      artifact: impactPath,
    }, options);
    await updatePhaseState(target, "report", {
      status: "success",
      completedAt: new Date().toISOString(),
      summary: impactPayload.summary,
      artifact: finalReportPath,
    }, options);
    await markPhaseComplete(target, "report", options);
    await writeReportLog("report_completed", {
      target,
      reports: impactPayload.summary.total,
      critical: impactPayload.summary.critical,
      high: impactPayload.summary.high,
      warnings: impactPayload.warnings.length,
    }, options);

    return reportPayload;
  } catch (error) {
    await updatePhaseState(target, "report", {
      status: "error",
      completedAt: new Date().toISOString(),
      error: error.message,
    }, options);
    await writeReportLog("report_failed", { target, message: error.message }, options);
    return {
      target,
      phase: "report",
      status: "error",
      error_type: "report_error",
      message: error.message,
    };
  }
}

export async function run_report(target, options = {}) {
  return runReport(target, options);
}

async function loadPocMarkdown(target, exploitData, warnings, options) {
  const pocLocation = exploitData?.poc?.location
    || path.join(getPhaseDirectory(target, "poc", options), "poc.md");

  try {
    return await readFile(pocLocation, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      warnings.push("PoC markdown was not found. The report was generated from exploit evidence only.");
      return "";
    }

    throw error;
  }
}

async function loadAiReportSummary(target, impactPayload, pocMarkdown, options) {
  if (typeof options.reportWriter !== "function") {
    return null;
  }

  return options.reportWriter({
    target,
    impactPayload,
    pocMarkdown,
  });
}

async function writeReportLog(message, meta = {}, options = {}) {
  const logFile = options.logFile || DEFAULT_LOG_FILE;
  await mkdir(path.dirname(logFile), { recursive: true });
  const suffix = Object.keys(meta).length
    ? ` ${Object.entries(meta).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ")}`
    : "";
  await appendFile(logFile, `${new Date().toISOString()} ${message}${suffix}\n`, "utf8");
}

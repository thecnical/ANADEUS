import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureWorkspaceStructure,
  getPhaseDirectory,
  loadPhaseData,
  savePhaseData,
  updatePhaseState,
  markPhaseComplete,
} from "../../orchestrator/phase_manager.js";
import {
  buildAiContext,
  buildAnalysisPayload,
  combineAnalysisSurface,
  inferEndpointCandidates,
  inferServiceCandidates,
  inferTechnologyCandidates,
  normalizeAiCandidates,
  writeAnalysisLog,
} from "./analysis_utils.js";

export async function runAnalysis(target, options = {}) {
  await ensureWorkspaceStructure(target, options);

  const reconData = await loadPhaseData(target, "recon", options);
  const scanData = await loadPhaseData(target, "scan", options);

  if (!scanData) {
    const errorResult = {
      target,
      phase: "analysis",
      status: "error",
      error_type: "missing_scan_data",
      message: `Scan data was not found for target '${target}'. Run scan first.`,
    };
    await updatePhaseState(target, "analysis", {
      status: "error",
      completedAt: new Date().toISOString(),
      error: errorResult.message,
    }, options);
    await writeAnalysisLog("analysis_failed", {
      target,
      error_type: errorResult.error_type,
      message: errorResult.message,
    }, options);
    return errorResult;
  }

  await writeAnalysisLog("analysis_started", { target }, options);
  await updatePhaseState(target, "analysis", {
    status: "running",
    startedAt: new Date().toISOString(),
  }, options);

  try {
    const surface = combineAnalysisSurface(reconData || {}, scanData || {});
    const heuristicCandidates = [
      ...surface.endpoints.flatMap((endpoint) => inferEndpointCandidates(endpoint)),
      ...inferTechnologyCandidates(surface.technologies, scanData.notes || []),
      ...inferServiceCandidates(surface.services, surface.ports),
    ];

    const aiCandidates = await runAiReasoning({
      target,
      reconData,
      scanData,
      heuristicCandidates,
      aiReasoner: options.aiReasoner,
    });

    const payload = buildAnalysisPayload(target, reconData, scanData, heuristicCandidates, aiCandidates);

    await savePhaseData(target, "analysis", payload, options);
    await saveVulnerabilityCandidates(target, payload, options);
    await updatePhaseState(target, "analysis", {
      status: "success",
      completedAt: new Date().toISOString(),
      summary: payload.counts,
    }, options);
    await markPhaseComplete(target, "analysis", options);
    await writeAnalysisLog("analysis_completed", {
      target,
      vulnerabilities: payload.counts.total,
      high: payload.counts.high,
      medium: payload.counts.medium,
      low: payload.counts.low,
      ai_generated: payload.summary.ai_generated,
    }, options);

    return payload;
  } catch (error) {
    await updatePhaseState(target, "analysis", {
      status: "error",
      completedAt: new Date().toISOString(),
      error: error.message,
    }, options);
    await writeAnalysisLog("analysis_failed", { target, message: error.message }, options);
    return {
      target,
      phase: "analysis",
      status: "error",
      error_type: "analysis_error",
      message: error.message,
    };
  }
}

export async function run_analysis(target, options = {}) {
  return runAnalysis(target, options);
}

async function runAiReasoning({ target, reconData, scanData, heuristicCandidates, aiReasoner }) {
  if (typeof aiReasoner !== "function") {
    return [];
  }

  const context = buildAiContext(target, reconData, scanData, heuristicCandidates);
  const response = await aiReasoner({
    prompt: buildReasoningPrompt(context),
    context,
  });
  return normalizeAiCandidates(response);
}

function buildReasoningPrompt(context) {
  return [
    "Analyze the following recon and scan context for likely web vulnerabilities.",
    "Prioritize SQL Injection, XSS, IDOR, CSRF, Auth Bypass, and Security Misconfiguration.",
    "Return an array of JSON objects with keys: type, endpoint, parameter, confidence, severity, reason, tags.",
    JSON.stringify(context),
  ].join("\n");
}

async function saveVulnerabilityCandidates(target, payload, options) {
  const analysisDirectory = getPhaseDirectory(target, "analysis", options);
  const filePath = path.join(analysisDirectory, "vuln_candidates.json");
  await mkdir(analysisDirectory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

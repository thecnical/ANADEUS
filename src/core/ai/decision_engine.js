import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runRecon } from "../../../agents/recon/recon_agent.js";
import { runScanner } from "../../../agents/scanner/scanner_agent.js";
import { runAnalysis } from "../../../agents/analysis/analysis_agent.js";
import { runExploit } from "../../../agents/exploit/exploit_agent.js";
import { runReport } from "../../../agents/report/report_agent.js";
import {
  buildAnalysisPrompt,
  buildDecisionPrompt,
  buildPlanningPrompt,
  buildReportPrompt,
  getFallbackTasksForPhase,
  AUTO_PHASE_SEQUENCE,
} from "./prompt_engine.js";
import { buildContextSnapshot, loadTargetContext, saveAiMemory } from "./context_engine.js";
import { createModelRouter } from "./model_router.js";
import {
  calculateDataQualityScore,
  deriveContextSignals,
  optimizeTasksForPhase,
  prioritizeCandidates,
  prioritizeTargets,
  reduceFalsePositives,
  scoreCandidateConfidence,
} from "./scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_FILE = path.resolve(__dirname, "..", "..", "..", "logs", "decision.log");

export async function generatePhaseTasks({ target, phase, mode = "deep", context, modelRouter, options = {} }) {
  const fallbackTasks = getFallbackTasksForPhase(phase, mode);
  const optimizedFallback = optimizeTasksForPhase(phase, fallbackTasks, context, mode);
  const heuristicConfidence = calculatePlanConfidence(optimizedFallback, context);

  if (!["recon", "scan"].includes(phase) || !modelRouter?.hasAvailableProviders()) {
    const response = {
      phase,
      tasks: optimizedFallback.tasks,
      rationale: buildFallbackPlanRationale(optimizedFallback.reasoning),
      source: "fallback",
      confidence: heuristicConfidence,
      skippedTasks: optimizedFallback.skipped,
      reasoning: optimizedFallback.reasoning,
      priorityTargets: prioritizeTargets(context),
    };
    await writeDecisionLog("phase_plan", {
      target,
      phase,
      source: response.source,
      confidence: response.confidence,
      skippedTasks: response.skippedTasks,
    }, options);
    return response;
  }

  try {
    const response = await modelRouter.generateObject({
      prompt: buildPlanningPrompt({
        target,
        phase,
        mode,
        context: buildContextSnapshot(context),
      }),
      temperature: 0.1,
      maxTokens: 1400,
    });

    const tasks = validatePhaseTasks(phase, response.object?.tasks, optimizedFallback.tasks);
    const optimizedTasks = optimizeTasksForPhase(phase, tasks, context, mode);
    const result = {
      phase,
      tasks: optimizedTasks.tasks,
      rationale: joinRationales([
        response.object?.rationale || "AI generated phase tasks.",
        ...optimizedTasks.reasoning,
      ]),
      source: response.provider,
      stop_conditions: response.object?.stop_conditions || [],
      confidence: calculatePlanConfidence(optimizedTasks, context),
      skippedTasks: optimizedTasks.skipped,
      reasoning: optimizedTasks.reasoning,
      priorityTargets: prioritizeTargets(context),
    };
    await writeDecisionLog("phase_plan", {
      target,
      phase,
      source: result.source,
      confidence: result.confidence,
      skippedTasks: result.skippedTasks,
    }, options);
    return result;
  } catch (error) {
    const response = {
      phase,
      tasks: optimizedFallback.tasks,
      rationale: `AI planning failed, so the optimized built-in task template was used. ${error.message}`,
      source: "fallback",
      confidence: heuristicConfidence,
      skippedTasks: optimizedFallback.skipped,
      reasoning: optimizedFallback.reasoning,
      priorityTargets: prioritizeTargets(context),
    };
    await writeDecisionLog("phase_plan_fallback", {
      target,
      phase,
      message: error.message,
      confidence: response.confidence,
    }, options);
    return response;
  }
}

export async function decideNextPhase({ target, context, modelRouter, options = {} }) {
  const heuristicDecision = determineHeuristicNextPhase(context);

  if (!heuristicDecision.should_continue || !modelRouter?.hasAvailableProviders()) {
    await writeDecisionLog("phase_decision", {
      target,
      source: "heuristic",
      next_phase: heuristicDecision.next_phase,
      should_continue: heuristicDecision.should_continue,
      rationale: heuristicDecision.rationale,
    }, options);
    return heuristicDecision;
  }

  try {
    const response = await modelRouter.generateObject({
      prompt: buildDecisionPrompt({
        target,
        context: buildContextSnapshot(context),
      }),
      temperature: 0.1,
      maxTokens: 900,
    });

    const normalized = normalizeAiDecision(response.object, heuristicDecision, context);
    await writeDecisionLog("phase_decision", {
      target,
      source: response.provider,
      next_phase: normalized.next_phase,
      should_continue: normalized.should_continue,
      rationale: normalized.rationale,
    }, options);
    return normalized;
  } catch (error) {
    const fallback = {
      ...heuristicDecision,
      rationale: `${heuristicDecision.rationale} AI decision fallback reason: ${error.message}`,
      source: "heuristic",
    };
    await writeDecisionLog("phase_decision_fallback", {
      target,
      message: error.message,
      next_phase: fallback.next_phase,
    }, options);
    return fallback;
  }
}

export async function createAnalysisReasoner({ target, context, modelRouter, options = {} }) {
  return async () => {
    if (!modelRouter?.hasAvailableProviders()) {
      return [];
    }

    const response = await modelRouter.generateObject({
      prompt: buildAnalysisPrompt({
        target,
        context: buildContextSnapshot(context),
      }),
      temperature: 0.1,
      maxTokens: 1800,
    });

    const rawCandidates = Array.isArray(response.object?.vulnerabilities)
      ? response.object.vulnerabilities
      : [];
    const filteredCandidates = prioritizeCandidates(
      reduceFalsePositives(rawCandidates, context).map((candidate) => ({
        ...candidate,
        likelihood: candidate.likelihood ?? Math.round(scoreCandidateConfidence(candidate, context) * 100),
      })),
      context,
    );

    await writeDecisionLog("analysis_reasoning", {
      target,
      source: response.provider,
      returned: rawCandidates.length,
      retained: filteredCandidates.length,
    }, options);

    return filteredCandidates;
  };
}

export async function createReportWriter({ target, context, modelRouter, options = {} }) {
  return async () => {
    if (!modelRouter?.hasAvailableProviders()) {
      return null;
    }

    const response = await modelRouter.generateObject({
      prompt: buildReportPrompt({
        target,
        context: buildContextSnapshot(context),
      }),
      temperature: 0.2,
      maxTokens: 1200,
    });

    await writeDecisionLog("report_reasoning", {
      target,
      source: response.provider,
      priorities: response.object?.remediation_priorities?.length || 0,
    }, options);

    return response.object || {};
  };
}

export async function preparePhaseExecution({ target, phase, mode, context, modelRouter, options = {} }) {
  const normalizedPhase = String(phase || "").toLowerCase();
  const signals = deriveContextSignals(context);
  const dataQuality = calculateDataQualityScore(context);

  const preparation = {
    skipPhase: false,
    rationale: "",
    options: {},
    confidence: Number(dataQuality.toFixed(2)),
    signals,
  };

  if (normalizedPhase === "recon" || normalizedPhase === "scan") {
    const plan = await generatePhaseTasks({
      target,
      phase: normalizedPhase,
      mode,
      context,
      modelRouter,
      options,
    });
    preparation.options.tasksOverride = plan.tasks;
    preparation.rationale = plan.rationale;
    preparation.confidence = plan.confidence;
    preparation.priorityTargets = plan.priorityTargets;
    preparation.skippedTasks = plan.skippedTasks;
  } else if (normalizedPhase === "analysis") {
    preparation.options.aiReasoner = await createAnalysisReasoner({
      target,
      context,
      modelRouter,
      options,
    });
    preparation.rationale = "Prepared AI-assisted analysis with false-positive reduction and confidence scoring.";
  } else if (normalizedPhase === "report") {
    preparation.options.reportWriter = await createReportWriter({
      target,
      context,
      modelRouter,
      options,
    });
    preparation.rationale = "Prepared AI-assisted report guidance with remediation prioritization.";
  }

  if (normalizedPhase === "report" && (context.exploit?.confirmed_vulnerabilities?.length || 0) === 0) {
    preparation.rationale = joinRationales([
      preparation.rationale,
      "Report phase will still run, but no confirmed vulnerabilities are currently available.",
    ]);
  }

  await writeDecisionLog("phase_prepared", {
    target,
    phase: normalizedPhase,
    confidence: preparation.confidence,
    rationale: preparation.rationale,
  }, options);

  return preparation;
}

export async function runAutoPipeline(target, options = {}) {
  const mode = normalizeDepth(options.mode || options.depth || "deep");
  const modelRouter = options.modelRouter || createModelRouter(options);
  const results = [];
  const pipelinePhases = [...AUTO_PHASE_SEQUENCE];

  while (true) {
    const context = await loadTargetContext(target, options);
    const decision = await decideNextPhase({
      target,
      context,
      modelRouter,
      options,
    });

    const phase = resolveAutoPhase(decision, {
      completedPhases: context.meta?.completedPhases || [],
      pipelinePhases,
    });

    if (!phase) {
      break;
    }

    await saveAiMemory(target, {
      phase,
      type: "decision",
      source: decision.source,
      rationale: decision.should_continue
        ? decision.rationale
        : joinRationales([
          decision.rationale,
          `Auto mode continued with ${phase} to complete the full artifact pipeline.`,
        ]),
      confidence: decision.confidence,
    }, options);

    const preparation = await preparePhaseExecution({
      target,
      phase,
      mode,
      context,
      modelRouter,
      options,
    });

    let result;
    if (phase === "recon") {
      result = await runRecon(target, mode, { ...options, ...preparation.options });
    } else if (phase === "scan") {
      result = await runScanner(target, mode, { ...options, ...preparation.options });
    } else if (phase === "analysis") {
      result = await runAnalysis(target, { ...options, ...preparation.options });
    } else if (phase === "exploit") {
      result = await runExploit(target, "safe", options);
    } else if (phase === "report") {
      result = await runReport(target, { ...options, ...preparation.options });
    } else {
      break;
    }

    results.push({
      phase,
      status: result.status,
      summary: extractPhaseSummary(result),
      decision: {
        rationale: decision.should_continue
          ? decision.rationale
          : joinRationales([
            decision.rationale,
            `The pipeline proceeded with ${phase} so downstream artifacts would still be generated.`,
          ]),
        confidence: decision.confidence,
      },
      preparation: {
        rationale: preparation.rationale,
        confidence: preparation.confidence,
        skippedTasks: preparation.skippedTasks || [],
      },
    });

  }

  const finalContext = await loadTargetContext(target, options);
  const progress = buildAutoProgress(results, finalContext);
  const overallStatus = results.some((item) => item.status === "error")
    ? "error"
    : results.some((item) => item.status === "partial")
      ? "partial"
      : "success";

  return {
    ok: overallStatus !== "error",
    type: "auto",
    target,
    mode,
    status: overallStatus,
    summary: `Auto mode completed ${results.length} phase${results.length === 1 ? "" : "s"} for ${target}.`,
    phases: results,
    progress,
    completedPhases: finalContext.meta?.completedPhases || [],
    artifacts: {
      recon: Boolean(finalContext.recon),
      scan: Boolean(finalContext.scan),
      analysis: Boolean(finalContext.analysis),
      exploit: Boolean(finalContext.exploit),
      report: Boolean(finalContext.report),
    },
  };
}

function resolveAutoPhase(decision, { completedPhases = [], pipelinePhases = [] }) {
  const requestedPhase = decision.should_continue ? decision.next_phase : null;
  if (requestedPhase && !completedPhases.includes(requestedPhase)) {
    return requestedPhase;
  }

  return pipelinePhases.find((phase) => !completedPhases.includes(phase)) || null;
}

function buildAutoProgress(results, finalContext) {
  const resultMap = new Map(results.map((item) => [item.phase, item.status]));
  return AUTO_PHASE_SEQUENCE.map((phase) => {
    if (resultMap.has(phase)) {
      return {
        phase,
        status: toProgressStatus(resultMap.get(phase)),
      };
    }

    const phaseState = finalContext.meta?.phases?.[phase]?.status;
    if (phaseState) {
      return {
        phase,
        status: toProgressStatus(phaseState),
      };
    }

    return {
      phase,
      status: "pending",
    };
  });
}

function toProgressStatus(status) {
  if (status === "success") {
    return "completed";
  }

  if (status === "partial") {
    return "warning";
  }

  if (status === "error") {
    return "failed";
  }

  return status || "pending";
}

export function determineHeuristicNextPhase(context = {}) {
  const completedPhases = context.meta?.completedPhases || [];
  const pending = AUTO_PHASE_SEQUENCE.filter((phase) => !completedPhases.includes(phase));
  const signals = deriveContextSignals(context);
  const dataQuality = calculateDataQualityScore(context);

  if (pending.length === 0) {
    return {
      should_continue: false,
      next_phase: null,
      rationale: "All auto-mode phases have already completed.",
      source: "heuristic",
      confidence: 1,
    };
  }

  if (completedPhases.includes("analysis") && signals.vulnerabilityCount === 0) {
    return {
      should_continue: false,
      next_phase: null,
      rationale: "Analysis produced no meaningful vulnerability candidates, so exploit and report were skipped.",
      source: "heuristic",
      confidence: 0.9,
    };
  }

  if (completedPhases.includes("scan") && !signals.hasWebSurface && !signals.hasOpenPorts) {
    return {
      should_continue: false,
      next_phase: null,
      rationale: "No attack surface was confirmed after scan, so later phases were skipped.",
      source: "heuristic",
      confidence: 0.88,
    };
  }

  if (completedPhases.includes("exploit") && signals.exploitConfirmedCount === 0) {
    return {
      should_continue: false,
      next_phase: null,
      rationale: "Exploit validation did not confirm any vulnerabilities, so report generation was skipped.",
      source: "heuristic",
      confidence: 0.91,
    };
  }

  const fallbackNextPhase = pending[0] || null;
  return {
    should_continue: Boolean(fallbackNextPhase),
    next_phase: fallbackNextPhase,
    rationale: dataQuality < 0.25
      ? "Data quality is still low, so the next phase was selected conservatively using pipeline order."
      : "The next pending phase was selected based on current context quality and completed work.",
    source: "heuristic",
    confidence: Number(Math.max(0.55, dataQuality).toFixed(2)),
  };
}

function normalizeAiDecision(candidateDecision, heuristicDecision, context) {
  const completedPhases = context.meta?.completedPhases || [];
  const requestedPhase = String(candidateDecision?.next_phase || "").toLowerCase();

  if (candidateDecision?.should_continue === false) {
    return heuristicDecision;
  }

  if (!AUTO_PHASE_SEQUENCE.includes(requestedPhase) || completedPhases.includes(requestedPhase)) {
    return heuristicDecision;
  }

  return {
    should_continue: true,
    next_phase: requestedPhase,
    rationale: candidateDecision?.rationale || heuristicDecision.rationale,
    source: "ai",
    confidence: heuristicDecision.confidence,
  };
}

function validatePhaseTasks(phase, candidateTasks, fallbackTasks) {
  if (!Array.isArray(candidateTasks) || candidateTasks.length === 0) {
    return fallbackTasks;
  }

  const allowedNames = new Set(fallbackTasks.map((task) => task.name));
  const validTasks = candidateTasks
    .filter((task) => task && typeof task === "object" && allowedNames.has(task.name))
    .map((task) => ({
      name: task.name,
      tools: Array.isArray(task.tools) && task.tools.length > 0
        ? task.tools
        : fallbackTasks.find((item) => item.name === task.name)?.tools || [],
      retries: Number.isInteger(task.retries) ? task.retries : 0,
      continueOnFailure: task.continueOnFailure !== false,
      ...(task.options && typeof task.options === "object" ? { options: task.options } : {}),
    }));

  return validTasks.length > 0 ? validTasks : fallbackTasks;
}

function extractPhaseSummary(result) {
  if (result?.summary) {
    return result.summary;
  }

  if (result?.counts) {
    return result.counts;
  }

  return null;
}

function buildFallbackPlanRationale(reasoning = []) {
  if (!reasoning.length) {
    return "Using built-in task template because AI planning was unavailable or not required.";
  }

  return joinRationales([
    "Using built-in task template because AI planning was unavailable or not required.",
    ...reasoning,
  ]);
}

function calculatePlanConfidence(plan, context) {
  const signals = plan.signals || deriveContextSignals(context);
  const base = calculateDataQualityScore(context);
  let confidence = base;

  if (signals.hasApiSurface || signals.hasLoginSurface || signals.hasAdminSurface) {
    confidence += 0.12;
  }

  if (Array.isArray(plan.skipped) && plan.skipped.length > 0) {
    confidence += 0.05;
  }

  return Number(Math.min(1, confidence).toFixed(2));
}

function normalizeDepth(value) {
  return String(value || "deep").toLowerCase().includes("light") ? "light" : "deep";
}

function joinRationales(parts = []) {
  return parts.filter(Boolean).join(" ");
}

async function writeDecisionLog(event, meta = {}, options = {}) {
  const logFile = options.decisionLogFile || DEFAULT_LOG_FILE;
  await mkdir(path.dirname(logFile), { recursive: true });
  const suffix = Object.keys(meta).length
    ? ` ${Object.entries(meta).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ")}`
    : "";
  await appendFile(logFile, `${new Date().toISOString()} ${event}${suffix}\n`, "utf8");
}

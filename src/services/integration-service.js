import { runRecon } from "../../agents/recon/recon_agent.js";
import { runScanner } from "../../agents/scanner/scanner_agent.js";
import { runAnalysis } from "../../agents/analysis/analysis_agent.js";
import { runExploit } from "../../agents/exploit/exploit_agent.js";
import { runReport } from "../../agents/report/report_agent.js";
import { executeAutoMode } from "./auto-mode-service.js";
import { writeSystemLog } from "./system-logger.js";
import { loadTargetContext } from "../core/ai/context_engine.js";
import { createModelRouter } from "../core/ai/model_router.js";
import { preparePhaseExecution } from "../core/ai/decision_engine.js";

export async function executeIntegratedPhase({ phase, target, mode, options = {} }) {
  const normalizedPhase = String(phase || "").trim().toLowerCase();
  const resolvedMode = mode || defaultModeForPhase(normalizedPhase);
  const context = await loadTargetContext(target, options);
  const modelRouter = options.modelRouter || createModelRouter(options);
  const preparation = await preparePhaseExecution({
    target,
    phase: normalizedPhase,
    mode: resolvedMode,
    context,
    modelRouter,
    options,
  });

  await writeSystemLog("phase_start", {
    phase: normalizedPhase,
    target,
    mode: resolvedMode,
    decision_confidence: preparation.confidence,
  }, options);

  try {
    let result;
    if (normalizedPhase === "recon") {
      result = await runRecon(target, resolvedMode, { ...options, ...preparation.options });
    } else if (normalizedPhase === "scan") {
      result = await runScanner(target, resolvedMode, { ...options, ...preparation.options });
    } else if (normalizedPhase === "analysis") {
      result = await runAnalysis(target, { ...options, ...preparation.options });
    } else if (normalizedPhase === "exploit") {
      result = await runExploit(target, resolvedMode, options);
    } else if (normalizedPhase === "report") {
      result = await runReport(target, { ...options, ...preparation.options });
    } else {
      throw new Error(`Unsupported integrated phase '${phase}'.`);
    }

    await writeSystemLog("phase_end", {
      phase: normalizedPhase,
      target,
      status: result.status,
      decision_rationale: preparation.rationale,
    }, options);

    return result;
  } catch (error) {
    await writeSystemLog("phase_error", {
      phase: normalizedPhase,
      target,
      message: error.message,
    }, options);
    throw error;
  }
}

export async function executeIntegratedAuto({ target, mode = "deep", options = {} }) {
  await writeSystemLog("auto_start", { target, mode }, options);
  const result = await executeAutoMode({ target, mode, options });
  await writeSystemLog("auto_end", {
    target,
    mode,
    status: result.status,
  }, options);
  return result;
}

function defaultModeForPhase(phase) {
  if (phase === "exploit") {
    return "safe";
  }

  if (phase === "analysis" || phase === "report") {
    return null;
  }

  return "deep";
}

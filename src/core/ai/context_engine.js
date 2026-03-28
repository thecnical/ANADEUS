import { loadMeta, loadPhaseData, saveMeta } from "../../../orchestrator/phase_manager.js";
import { AUTO_PHASE_SEQUENCE } from "./prompt_engine.js";

export async function loadTargetContext(target, options = {}) {
  const [meta, recon, scan, analysis, exploit, report] = await Promise.all([
    loadMeta(target, options),
    loadPhaseData(target, "recon", options),
    loadPhaseData(target, "scan", options),
    loadPhaseData(target, "analysis", options),
    loadPhaseData(target, "exploit", options),
    loadPhaseData(target, "report", options),
  ]);

  return {
    target,
    meta,
    recon,
    scan,
    analysis,
    exploit,
    report,
  };
}

export function buildPhaseProgress(context = {}) {
  const completed = new Set(context.meta?.completedPhases || []);
  const active = context.meta?.activePhase || null;

  return AUTO_PHASE_SEQUENCE.map((phase) => ({
    phase,
    status: completed.has(phase)
      ? "completed"
      : active === phase
        ? "running"
        : "pending",
  }));
}

export function findLastCompletedPhase(context = {}) {
  const completed = context.meta?.completedPhases || [];
  return completed.length > 0 ? completed[completed.length - 1] : null;
}

export async function saveAiMemory(target, entry, options = {}) {
  const meta = await loadMeta(target, options);
  const aiMemory = Array.isArray(meta.aiMemory) ? meta.aiMemory : [];

  aiMemory.push({
    ...entry,
    recordedAt: new Date().toISOString(),
  });

  meta.aiMemory = aiMemory.slice(-25);
  await saveMeta(target, meta, options);
  return meta.aiMemory;
}

export function buildContextSnapshot(context = {}) {
  return {
    target: context.target,
    meta: {
      activePhase: context.meta?.activePhase || null,
      completedPhases: context.meta?.completedPhases || [],
      aiMemory: context.meta?.aiMemory || [],
    },
    recon: context.recon || null,
    scan: context.scan || null,
    analysis: context.analysis || null,
    exploit: context.exploit || null,
    report: context.report || null,
  };
}

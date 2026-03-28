import { buildReconTasks } from "../../../agents/recon/recon_utils.js";
import { buildScannerTasks } from "../../../agents/scanner/scanner_utils.js";
import { calculateDataQualityScore, deriveContextSignals, prioritizeTargets } from "./scoring.js";

export const AUTO_PHASE_SEQUENCE = ["recon", "scan", "analysis", "exploit", "report"];

export function buildPlanningPrompt({ target, phase, mode = "deep", context = {} }) {
  const normalizedPhase = String(phase || "").trim().toLowerCase();
  const fallbackTasks = getFallbackTasksForPhase(normalizedPhase, mode);
  const contextSummary = summarizeContext(context);

  return [
    "You are ANADEUS, an ethical cybersecurity orchestration planner.",
    "Generate a JSON object only.",
    "Return keys: phase, tasks, rationale, stop_conditions.",
    "Each task must have: name, tools, retries, continueOnFailure, optional options.",
    "Prefer safe, non-destructive enumeration and validation logic.",
    "Prioritize high-value targets such as authentication workflows, admin surfaces, and API endpoints.",
    "Skip tasks that do not add signal when the context already shows they are unnecessary.",
    `Target: ${target}`,
    `Phase: ${normalizedPhase}`,
    `Mode: ${mode}`,
    `Available workspace context: ${JSON.stringify(contextSummary)}`,
    `High-value targets: ${JSON.stringify(contextSummary.priorityTargets)}`,
    `Reference fallback tasks for this phase: ${JSON.stringify(fallbackTasks)}`,
  ].join("\n");
}

export function buildAnalysisPrompt({ target, context = {} }) {
  const contextSummary = summarizeContext(context);
  return [
    "You are ANADEUS performing vulnerability candidate analysis for an authorized target.",
    "Return JSON only with key: vulnerabilities.",
    "Each vulnerability must include: type, endpoint, parameter, confidence, severity, reason, tags.",
    "Only return candidates that are supported by the context. Prefer fewer, stronger findings over broad noisy output.",
    "High-confidence auth, API, and data exposure issues should be prioritized.",
    "Focus on SQL Injection, XSS, IDOR, CSRF, Auth Bypass, and Security Misconfiguration.",
    `Target: ${target}`,
    `Context: ${JSON.stringify(contextSummary)}`,
  ].join("\n");
}

export function buildReportPrompt({ target, context = {} }) {
  const contextSummary = summarizeContext(context);
  return [
    "You are ANADEUS generating concise professional security-report guidance.",
    "Return JSON only with keys: executive_summary, remediation_priorities, analyst_notes.",
    "Keep the tone suitable for a bug bounty or internal AppSec report.",
    "Prioritize remediation guidance for access control, data exposure, and injection risk first.",
    `Target: ${target}`,
    `Context: ${JSON.stringify(contextSummary)}`,
  ].join("\n");
}

export function buildDecisionPrompt({ target, context = {} }) {
  const contextSummary = summarizeContext(context);
  return [
    "You are ANADEUS deciding the next safe pipeline step.",
    "Return JSON only with keys: should_continue, next_phase, rationale, stop_reason.",
    "Use the context to skip unnecessary work, stop early when no meaningful findings remain, and repeat only if the data quality is weak.",
    `Target: ${target}`,
    `Current context: ${JSON.stringify(contextSummary)}`,
    `Allowed phases: ${JSON.stringify(AUTO_PHASE_SEQUENCE)}`,
  ].join("\n");
}

export function buildChatPrompt({ message, context = {} }) {
  return [
    "You are ANADEUS, an AI cybersecurity assistant for ethical security testing.",
    "Give concise, professional, safety-aware answers.",
    "When relevant, mention the ANADEUS command or phase that best fits the user's goal.",
    `Workspace context: ${JSON.stringify(summarizeContext(context))}`,
    `User message: ${message}`,
  ].join("\n");
}

export function getFallbackTasksForPhase(phase, mode = "deep") {
  if (phase === "recon") {
    return buildReconTasks(mode);
  }

  if (phase === "scan") {
    return buildScannerTasks(mode);
  }

  return [];
}

function summarizeContext(context = {}) {
  const signals = deriveContextSignals(context);
  return {
    target: context.target || null,
    completedPhases: context.meta?.completedPhases || [],
    activePhase: context.meta?.activePhase || null,
    dataQualityScore: calculateDataQualityScore(context),
    signals,
    priorityTargets: prioritizeTargets(context),
    recon: {
      subdomains: context.recon?.subdomains?.length || 0,
      alive_hosts: context.recon?.alive_hosts?.length || 0,
      technologies: context.recon?.technologies?.length || 0,
      endpoints: context.recon?.endpoints?.length || 0,
    },
    scan: {
      endpoints: context.scan?.endpoints?.length || 0,
      directories: context.scan?.directories?.length || 0,
      open_ports: context.scan?.open_ports?.length || 0,
      services: context.scan?.services?.length || 0,
    },
    analysis: {
      vulnerabilities: context.analysis?.vulnerabilities?.length || 0,
    },
    exploit: {
      confirmed: context.exploit?.confirmed_vulnerabilities?.length || 0,
    },
  };
}

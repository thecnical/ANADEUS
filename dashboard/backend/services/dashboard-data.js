import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getTargetWorkspacePath,
  getWorkspaceRoot,
  loadMeta,
  loadPhaseData,
  PHASES,
} from "../../../orchestrator/phase_manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DEFAULT_LOGS_DIRECTORY = path.join(REPO_ROOT, "logs");

export async function listTargets(options = {}) {
  const workspaceRoot = getWorkspaceRoot(options);

  try {
    const entries = await readdir(workspaceRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function getTargetSnapshot(target, options = {}) {
  const targetId = String(target || "").trim().toLowerCase();
  const workspacePath = getTargetWorkspacePath(targetId, options);
  const meta = await loadMeta(targetId, options);
  const [recon, scan, analysis, exploit, report, impact, pocMarkdown, finalReport] = await Promise.all([
    loadPhaseData(targetId, "recon", options),
    loadPhaseData(targetId, "scan", options),
    loadPhaseData(targetId, "analysis", options),
    loadPhaseData(targetId, "exploit", options),
    loadPhaseData(targetId, "report", options),
    readJsonFile(path.join(workspacePath, "report", "impact.json")),
    readTextFile(path.join(workspacePath, "poc", "poc.md")),
    readTextFile(path.join(workspacePath, "report", "final_report.md")),
  ]);

  const vulnerabilities = buildVulnerabilities({
    target: targetId,
    impact,
    report,
    exploit,
    analysis,
  });

  return {
    target: targetId,
    workspace: workspacePath,
    meta,
    currentPhase: meta.activePhase || inferCurrentPhase(meta),
    progress: buildProgress(meta),
    recon: normalizeRecon(recon),
    scan: normalizeScan(scan),
    analysis: normalizeAnalysis(analysis),
    exploit: normalizeExploit(exploit),
    report: {
      ...normalizeReport(report),
      impact: impact?.reports || [],
      markdown: finalReport,
      pocMarkdown,
    },
    vulnerabilities,
    system: {
      activeAgents: meta.activePhase ? [meta.activePhase] : [],
      executionStatus: inferExecutionStatus(meta),
      performance: aggregatePerformance([recon, scan, analysis, exploit, report]),
    },
  };
}

export async function getReports(options = {}) {
  const targets = await listTargets(options);
  const reports = [];

  for (const target of targets) {
    const snapshot = await getTargetSnapshot(target, options);
    if (!snapshot.report.markdown && snapshot.report.impact.length === 0) {
      continue;
    }

    reports.push({
      target,
      title: snapshot.report.impact[0]?.title || `ANADEUS report for ${target}`,
      generatedAt: snapshot.meta.updatedAt,
      severityBreakdown: buildSeverityBreakdown(snapshot.vulnerabilities),
      downloadPath: `/api/report/${encodeURIComponent(target)}/download`,
      preview: snapshot.report.markdown?.slice(0, 280) || "",
    });
  }

  return reports.sort((left, right) => String(right.generatedAt || "").localeCompare(String(left.generatedAt || "")));
}

export async function getVulnerabilities(options = {}) {
  const targets = await listTargets(options);
  const vulnerabilities = [];

  for (const target of targets) {
    const snapshot = await getTargetSnapshot(target, options);
    vulnerabilities.push(...snapshot.vulnerabilities);
  }

  return vulnerabilities.sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
}

export async function getSystemStatus(options = {}) {
  const targets = await listTargets(options);
  const targetSummaries = [];
  const logFiles = [
    "system.log",
    "performance.log",
    "analysis.log",
    "report.log",
  ];

  for (const target of targets) {
    const snapshot = await getTargetSnapshot(target, options);
    targetSummaries.push({
      target,
      currentPhase: snapshot.currentPhase,
      executionStatus: snapshot.system.executionStatus,
      activeAgents: snapshot.system.activeAgents,
      performance: snapshot.system.performance,
      progress: snapshot.progress,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    activeAgents: [...new Set(targetSummaries.flatMap((item) => item.activeAgents))],
    activeTargets: targetSummaries.filter((item) => item.executionStatus === "running").map((item) => item.target),
    targets: targetSummaries,
    performance: aggregateFleetPerformance(targetSummaries),
    logs: await readRecentLogs(logFiles, options),
  };
}

export async function getDashboardSnapshot(options = {}) {
  const [targets, reports, vulnerabilities, system] = await Promise.all([
    listTargets(options),
    getReports(options),
    getVulnerabilities(options),
    getSystemStatus(options),
  ]);

  const targetDetails = {};
  for (const target of targets) {
    targetDetails[target] = await getTargetSnapshot(target, options);
  }

  return {
    generatedAt: new Date().toISOString(),
    targets,
    targetDetails,
    reports,
    vulnerabilities,
    system,
  };
}

export async function getReportMarkdown(target, options = {}) {
  const workspacePath = getTargetWorkspacePath(target, options);
  return readTextFile(path.join(workspacePath, "report", "final_report.md"));
}

function normalizeRecon(recon) {
  return {
    status: recon?.status || "idle",
    subdomains: recon?.subdomains || [],
    alive_hosts: recon?.alive_hosts || [],
    technologies: recon?.technologies || [],
    endpoints: recon?.endpoints || [],
    ip_map: recon?.ip_map || {},
  };
}

function normalizeScan(scan) {
  return {
    status: scan?.status || "idle",
    hosts_scanned: scan?.hosts_scanned || [],
    open_ports: scan?.open_ports || [],
    services: scan?.services || [],
    technologies: scan?.technologies || [],
    directories: scan?.directories || [],
    endpoints: scan?.endpoints || [],
    notes: scan?.notes || [],
  };
}

function normalizeAnalysis(analysis) {
  return {
    status: analysis?.status || "idle",
    vulnerabilities: analysis?.vulnerabilities || [],
  };
}

function normalizeExploit(exploit) {
  return {
    status: exploit?.status || "idle",
    confirmed_vulnerabilities: exploit?.confirmed_vulnerabilities || [],
  };
}

function normalizeReport(report) {
  return {
    status: report?.status || "idle",
    reports: report?.reports || [],
  };
}

function buildVulnerabilities({ target, impact, report, exploit, analysis }) {
  const fromImpact = impact?.reports?.map((item) => ({
    target,
    type: item.type,
    severity: item.severity,
    endpoint: item.endpoint,
    confidence: item.confidence,
    impact: item.impact,
    businessImpact: item.business_impact,
    cvssLike: item.cvss_like,
    title: item.title,
    status: "reported",
  })) || [];

  if (fromImpact.length > 0) {
    return fromImpact;
  }

  const confirmed = exploit?.confirmed_vulnerabilities?.map((item) => ({
    target,
    type: item.type,
    severity: item.severity || "Medium",
    endpoint: item.endpoint,
    confidence: item.confidence,
    impact: item.evidence?.join(" ") || item.reason || "",
    title: `${item.type} at ${item.endpoint}`,
    status: item.status || "confirmed",
  })) || [];

  if (confirmed.length > 0) {
    return confirmed;
  }

  return analysis?.vulnerabilities?.map((item) => ({
    target,
    type: item.type,
    severity: item.severity || "Medium",
    endpoint: item.endpoint,
    confidence: item.confidence,
    impact: item.reason,
    title: `${item.type} candidate at ${item.endpoint}`,
    status: "candidate",
  })) || [];
}

function buildProgress(meta) {
  return PHASES
    .filter((phase) => ["recon", "scan", "analysis", "exploit", "report"].includes(phase))
    .map((phase) => {
      const state = meta?.phases?.[phase];
      return {
        phase,
        status: state?.status === "success"
          ? "completed"
          : state?.status === "partial"
            ? "warning"
            : state?.status === "error"
              ? "failed"
              : meta?.activePhase === phase
                ? "running"
                : "pending",
      };
    });
}

function inferCurrentPhase(meta) {
  if (meta?.activePhase) {
    return meta.activePhase;
  }

  const phases = Object.entries(meta?.phases || {})
    .filter(([, value]) => value?.status === "success" || value?.status === "partial")
    .map(([phase]) => phase);
  return phases.at(-1) || null;
}

function inferExecutionStatus(meta) {
  if (!meta?.phases || Object.keys(meta.phases).length === 0) {
    return "idle";
  }

  if (meta.activePhase && meta.phases?.[meta.activePhase]?.status === "running") {
    return "running";
  }

  if (Object.values(meta.phases).some((phase) => phase?.status === "error")) {
    return "degraded";
  }

  return "ready";
}

function aggregatePerformance(phases) {
  const phaseMetrics = phases
    .map((phase) => phase?.performance)
    .filter(Boolean);

  return phaseMetrics.reduce((accumulator, item) => ({
    taskCount: accumulator.taskCount + (item.taskCount || 0),
    toolExecutions: accumulator.toolExecutions + (item.toolExecutions || 0),
    cacheHits: accumulator.cacheHits + (item.cacheHits || 0),
    totalExecutionTime: Number((accumulator.totalExecutionTime + (item.totalExecutionTime || 0)).toFixed(4)),
  }), {
    taskCount: 0,
    toolExecutions: 0,
    cacheHits: 0,
    totalExecutionTime: 0,
  });
}

function aggregateFleetPerformance(targets) {
  return targets.reduce((accumulator, item) => ({
    taskCount: accumulator.taskCount + (item.performance?.taskCount || 0),
    toolExecutions: accumulator.toolExecutions + (item.performance?.toolExecutions || 0),
    cacheHits: accumulator.cacheHits + (item.performance?.cacheHits || 0),
    totalExecutionTime: Number((accumulator.totalExecutionTime + (item.performance?.totalExecutionTime || 0)).toFixed(4)),
  }), {
    taskCount: 0,
    toolExecutions: 0,
    cacheHits: 0,
    totalExecutionTime: 0,
  });
}

function buildSeverityBreakdown(vulnerabilities) {
  return vulnerabilities.reduce((accumulator, item) => {
    const severity = item.severity || "Unknown";
    accumulator[severity] = (accumulator[severity] || 0) + 1;
    return accumulator;
  }, {});
}

function severityRank(severity) {
  const value = String(severity || "").toLowerCase();
  if (value === "critical") {
    return 4;
  }
  if (value === "high") {
    return 3;
  }
  if (value === "medium") {
    return 2;
  }
  if (value === "low") {
    return 1;
  }
  return 0;
}

async function readRecentLogs(logFiles, options = {}) {
  const logsDirectory = options.logsDirectory || DEFAULT_LOGS_DIRECTORY;
  const results = {};

  await Promise.all(logFiles.map(async (logFileName) => {
    const fullPath = path.join(logsDirectory, logFileName);
    const content = await readTextFile(fullPath);
    results[logFileName] = content
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-15);
  }));

  return results;
}

async function readJsonFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readTextFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

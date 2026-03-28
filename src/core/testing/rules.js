import path from "node:path";
import { getPhaseDirectory, getPhaseFilePath } from "../../../orchestrator/phase_manager.js";

export const TEST_PHASES = ["recon", "scan", "analysis", "exploit", "report"];

export function getValidationConfig(phase, target, options = {}) {
  const normalizedPhase = String(phase || "").trim().toLowerCase();
  const phaseDirectory = getPhaseDirectory(target, normalizedPhase === "analysis" ? "analysis" : normalizedPhase, options);

  if (normalizedPhase === "analysis") {
    return {
      phase: normalizedPhase,
      artifactPath: path.join(phaseDirectory, "vuln_candidates.json"),
      requiredFields: ["target", "vulnerabilities", "status"],
      validator: validateAnalysis,
    };
  }

  if (normalizedPhase === "report") {
    return {
      phase: normalizedPhase,
      artifactPath: path.join(getPhaseDirectory(target, "report", options), "impact.json"),
      requiredFields: ["target", "reports", "status"],
      validator: validateReport,
    };
  }

  return {
    phase: normalizedPhase,
    artifactPath: getPhaseFilePath(target, normalizedPhase, options),
    requiredFields: defaultRequiredFields(normalizedPhase),
    validator: validationMap[normalizedPhase],
  };
}

export function defaultRequiredFields(phase) {
  if (phase === "recon") {
    return ["target", "subdomains", "status"];
  }

  if (phase === "scan") {
    return ["target", "endpoints", "open_ports", "status"];
  }

  if (phase === "exploit") {
    return ["target", "confirmed_vulnerabilities", "status"];
  }

  return ["target", "status"];
}

export function validateRecon(data, target) {
  if (data.target !== target) {
    return issue("error", "Target mismatch in recon output.");
  }

  if (!Array.isArray(data.subdomains) || data.subdomains.length === 0) {
    return issue("error", "No subdomains found in recon output.");
  }

  return issue("pass", "Recon output is valid.");
}

export function validateScan(data) {
  const hasEndpoints = Array.isArray(data.endpoints) && data.endpoints.length > 0;
  const hasPorts = Array.isArray(data.open_ports) && data.open_ports.length > 0;

  if (!hasEndpoints && !hasPorts) {
    return issue(
      data.status === "error" ? "error" : "warning",
      "No endpoints or open ports were confirmed in scan output.",
    );
  }

  return issue("pass", "Scan output is valid.");
}

export function validateAnalysis(data) {
  if (!Array.isArray(data.vulnerabilities)) {
    return issue("error", "Vulnerabilities array is missing from analysis output.");
  }

  if (data.vulnerabilities.length === 0) {
    return issue("warning", "Vulnerabilities array is present but empty.");
  }

  return issue("pass", "Analysis output is valid.");
}

export function validateExploit(data) {
  if (!Array.isArray(data.confirmed_vulnerabilities)) {
    return issue("error", "confirmed_vulnerabilities is missing from exploit output.");
  }

  if (data.confirmed_vulnerabilities.length === 0) {
    return issue("warning", "No confirmed vulnerabilities were produced by exploit validation.");
  }

  return issue("pass", "Exploit output is valid.");
}

export function validateReport(data) {
  if (!Array.isArray(data.reports)) {
    return issue("error", "Reports array is missing from report output.");
  }

  if (data.reports.length === 0) {
    return issue("warning", "Report output exists but contains no findings.");
  }

  const invalidReport = data.reports.find((report) => !report.severity || !report.impact);
  if (invalidReport) {
    return issue("error", "A report entry is missing severity or impact.");
  }

  return issue("pass", "Report output is valid.");
}

const validationMap = {
  recon: validateRecon,
  scan: validateScan,
  analysis: validateAnalysis,
  exploit: validateExploit,
  report: validateReport,
};

function issue(status, issueText) {
  return {
    status,
    issue: issueText,
  };
}

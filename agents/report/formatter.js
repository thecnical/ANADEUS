function renderExecutiveSummary(target, payload) {
  const aiSummary = payload.ai_summary?.executive_summary;

  if (payload.reports.length === 0) {
    return [
      `## Executive Summary`,
      ``,
      `No confirmed vulnerabilities were available for report generation for \`${target}\`.`,
      `The exploit phase completed without a submission-ready confirmation.`,
      aiSummary ? aiSummary : null,
      ``,
    ].filter(Boolean).join("\n");
  }

  return [
    `## Executive Summary`,
    ``,
    `ANADEUS generated ${payload.summary.total} confirmed finding${payload.summary.total === 1 ? "" : "s"} for \`${target}\`.`,
    `The current distribution is ${payload.summary.critical} Critical, ${payload.summary.high} High, ${payload.summary.medium} Medium, and ${payload.summary.low} Low.`,
    `The findings below are written for professional bug bounty or internal security review workflows.`,
    aiSummary ? aiSummary : null,
    ``,
  ].filter(Boolean).join("\n");
}

function renderWarnings(payload) {
  const aiNotes = Array.isArray(payload.ai_summary?.analyst_notes)
    ? payload.ai_summary.analyst_notes
    : [];

  if (!payload.warnings.length && aiNotes.length === 0) {
    return "";
  }

  return [
    `## Notes`,
    ``,
    ...payload.warnings.map((warning) => `- ${warning}`),
    ...aiNotes.map((note) => `- ${note}`),
    ``,
  ].join("\n");
}

function renderReportEntry(report, index) {
  const steps = report.steps_to_reproduce.length > 0
    ? report.steps_to_reproduce.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n")
    : "1. Follow the validation evidence from the exploit phase.\n2. Reproduce the observed behavior in an in-scope test context.";

  const evidence = report.evidence.length > 0
    ? report.evidence.map((item) => `- ${item}`).join("\n")
    : "- Validation evidence was limited but sufficient for the confirmation state recorded in the exploit phase.";

  return [
    `## ${index + 1}. ${report.title}`,
    ``,
    `### Summary`,
    report.summary,
    ``,
    `### Affected Endpoint`,
    `- Endpoint: \`${report.endpoint}\``,
    `- Vulnerability Type: ${report.type}`,
    `- Severity: ${report.severity}`,
    `- Confidence: ${report.confidence}`,
    `- CVSS-Like Score: ${report.cvss_like}`,
    report.parameter ? `- Parameter: \`${report.parameter}\`` : null,
    ``,
    `### Impact`,
    report.impact,
    ``,
    `### Business Impact`,
    report.business_impact,
    ``,
    `### Steps to Reproduce`,
    steps,
    ``,
    `### Evidence`,
    evidence,
    ``,
    `### Recommended Fix`,
    report.fix_recommendation,
    ``,
  ].filter(Boolean).join("\n");
}

function renderAppendix(pocMarkdown) {
  if (!pocMarkdown) {
    return "";
  }

  return [
    `## Appendix: PoC Notes`,
    ``,
    pocMarkdown.trim(),
    ``,
  ].join("\n");
}

export function renderFinalReport(target, payload, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const reportSections = payload.reports.map((report, index) => renderReportEntry(report, index)).join("\n");

  return [
    `# ANADEUS Security Report`,
    ``,
    `Target: ${target}`,
    `Generated: ${generatedAt}`,
    ``,
    renderExecutiveSummary(target, payload),
    renderWarnings(payload),
    reportSections || `## Findings\n\nNo confirmed vulnerabilities were available for report generation.\n`,
    renderAppendix(options.pocMarkdown || ""),
  ].filter(Boolean).join("\n");
}

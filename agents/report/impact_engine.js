export function dedupeStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

export function normalizeFinding(finding = {}) {
  return {
    type: String(finding.type || "Unknown"),
    endpoint: String(finding.endpoint || "/"),
    parameter: finding.parameter ? String(finding.parameter) : null,
    confidence: String(finding.confidence || "medium").toLowerCase(),
    severity: String(finding.severity || "medium").toLowerCase(),
    reason: finding.reason || "Confirmed during safe validation.",
    evidence: Array.isArray(finding.evidence) ? dedupeStrings(finding.evidence) : [],
    poc_steps: Array.isArray(finding.poc_steps) ? dedupeStrings(finding.poc_steps) : [],
    notes: Array.isArray(finding.notes) ? dedupeStrings(finding.notes) : [],
  };
}

export function classifySeverity(finding) {
  const type = String(finding.type || "").toLowerCase();
  const endpoint = String(finding.endpoint || "").toLowerCase();
  const confidence = String(finding.confidence || "medium").toLowerCase();

  if (type.includes("auth bypass")) {
    return endpoint.includes("admin") || endpoint.includes("dashboard") ? "Critical" : "High";
  }

  if (type.includes("sql")) {
    return confidence === "high" ? "High" : "Medium";
  }

  if (type.includes("idor")) {
    return endpoint.includes("admin") ? "High" : "High";
  }

  if (type.includes("xss")) {
    return confidence === "high" ? "High" : "Medium";
  }

  if (type.includes("csrf")) {
    return "Medium";
  }

  if (type.includes("misconfiguration")) {
    return "Low";
  }

  return capitalizeSeverity(finding.severity || "Medium");
}

export function calculateCvssLikeScore(finding, severity) {
  const severityScores = {
    Critical: 9.4,
    High: 8.3,
    Medium: 5.8,
    Low: 3.1,
  };
  const confidenceBonus = String(finding.confidence || "").toLowerCase() === "high"
    ? 0.4
    : String(finding.confidence || "").toLowerCase() === "medium"
      ? 0.1
      : -0.3;

  return clampScore((severityScores[severity] || 4.0) + confidenceBonus);
}

export function buildImpactNarrative(finding, severity) {
  const type = String(finding.type || "").toLowerCase();

  if (type.includes("sql")) {
    return "A successful SQL injection could expose application data, influence backend query behavior, and become a stepping stone toward broader compromise of database-backed functionality.";
  }

  if (type.includes("xss")) {
    return "This issue could let an attacker execute script in a victim browser context, enabling session abuse, sensitive data theft, or user-interface manipulation against affected users.";
  }

  if (type.includes("idor")) {
    return "The finding indicates a broken object-level authorization risk that could expose records belonging to other users, leading to unauthorized data access and privacy impact.";
  }

  if (type.includes("auth bypass")) {
    return severity === "Critical"
      ? "The issue could allow unauthorized access to privileged administrative functionality, creating a direct path to severe account compromise or platform control."
      : "The issue could allow unauthorized access to protected functionality, weakening trust boundaries and exposing sensitive actions or data.";
  }

  if (type.includes("csrf")) {
    return "If exploitable in a state-changing workflow, this issue could let an attacker trigger unintended actions in an authenticated user session.";
  }

  if (type.includes("misconfiguration")) {
    return "The exposure increases the attack surface by revealing implementation detail or unsafe defaults that can assist follow-on attacks.";
  }

  return "The confirmed behavior creates a security weakness with operational and data-protection implications that should be remediated promptly.";
}

export function buildBusinessImpact(finding, severity) {
  const type = String(finding.type || "").toLowerCase();

  if (type.includes("auth bypass")) {
    return severity === "Critical"
      ? "Unauthorized administrative access could result in tenant-wide compromise, service misuse, and loss of trust."
      : "Unauthorized access to protected features could lead to abuse of account functions and exposure of restricted content.";
  }

  if (type.includes("idor")) {
    return "Unauthorized record access could expose customer or internal data and create regulatory, privacy, and trust consequences.";
  }

  if (type.includes("sql")) {
    return "Backend data exposure or manipulation could affect data confidentiality, application reliability, and incident-response overhead.";
  }

  if (type.includes("xss")) {
    return "User-session abuse or client-side content injection could impact account integrity and erode confidence in the platform.";
  }

  if (type.includes("csrf")) {
    return "Users could be tricked into performing unintended actions, introducing integrity and workflow risk.";
  }

  return "The weakness increases security risk and should be fixed before it contributes to a broader compromise path.";
}

export function buildFixRecommendation(finding) {
  const type = String(finding.type || "").toLowerCase();

  if (type.includes("sql")) {
    return "Use parameterized queries or prepared statements consistently, validate input types strictly, and suppress verbose database error output.";
  }

  if (type.includes("xss")) {
    return "Apply context-aware output encoding, sanitize untrusted input where appropriate, and adopt a restrictive Content Security Policy.";
  }

  if (type.includes("idor")) {
    return "Enforce server-side authorization checks for every object lookup and avoid trusting user-supplied identifiers without access validation.";
  }

  if (type.includes("auth bypass")) {
    return "Require authorization checks on every protected route, verify session state on the server side, and deny access by default to privileged resources.";
  }

  if (type.includes("csrf")) {
    return "Add anti-CSRF tokens to state-changing requests, enforce origin validation, and use appropriately configured SameSite cookies.";
  }

  if (type.includes("misconfiguration")) {
    return "Remove unnecessary headers or verbose banners, review default configurations, and harden exposed services using least-privilege settings.";
  }

  return "Apply a defense-in-depth remediation plan focused on input handling, authorization enforcement, and secure defaults.";
}

export function buildTags(finding) {
  const type = String(finding.type || "").toLowerCase();
  const tags = [];

  if (type.includes("auth")) {
    tags.push("auth");
  }
  if (type.includes("idor")) {
    tags.push("authorization", "api");
  }
  if (type.includes("sql")) {
    tags.push("injection", "database");
  }
  if (type.includes("xss")) {
    tags.push("client-side", "input");
  }
  if (type.includes("csrf")) {
    tags.push("request-forgery");
  }
  if (type.includes("misconfiguration")) {
    tags.push("misconfig");
  }

  return dedupeStrings(tags);
}

export function buildReportEntry(finding) {
  const normalized = normalizeFinding(finding);
  const severity = classifySeverity(normalized);
  const cvss_like = calculateCvssLikeScore(normalized, severity);

  return {
    title: buildTitle(normalized, severity),
    type: normalized.type,
    severity,
    cvss_like,
    impact: buildImpactNarrative(normalized, severity),
    business_impact: buildBusinessImpact(normalized, severity),
    endpoint: normalized.endpoint,
    parameter: normalized.parameter,
    confidence: normalized.confidence,
    summary: normalized.reason,
    evidence: normalized.evidence,
    steps_to_reproduce: normalized.poc_steps,
    fix_recommendation: buildFixRecommendation(normalized),
    tags: buildTags(normalized),
  };
}

export function buildImpactPayload(target, reports = [], warnings = []) {
  const sortedReports = [...reports].sort((left, right) => {
    const severityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const severityDiff = (severityOrder[right.severity] || 0) - (severityOrder[left.severity] || 0);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return right.cvss_like - left.cvss_like;
  });

  return {
    target,
    phase: "report",
    status: "success",
    reports: sortedReports,
    summary: {
      total: sortedReports.length,
      critical: sortedReports.filter((item) => item.severity === "Critical").length,
      high: sortedReports.filter((item) => item.severity === "High").length,
      medium: sortedReports.filter((item) => item.severity === "Medium").length,
      low: sortedReports.filter((item) => item.severity === "Low").length,
    },
    warnings: dedupeStrings(warnings),
    generated_at: new Date().toISOString(),
  };
}

function buildTitle(finding, severity) {
  return `${finding.type} at ${finding.endpoint} (${severity})`;
}

function capitalizeSeverity(value) {
  const text = String(value || "medium").toLowerCase();
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;
}

function clampScore(value) {
  return Math.max(0, Math.min(10, Number(value.toFixed(1))));
}

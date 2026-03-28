import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_FILE = path.resolve(__dirname, "..", "..", "logs", "analysis.log");

const SEVERITY_SCORE = { high: 3, medium: 2, low: 1 };
const CONFIDENCE_SCORE = { high: 3, medium: 2, low: 1 };

const IDOR_PARAMS = new Set(["id", "user", "user_id", "account", "account_id", "profile", "project", "project_id", "order", "order_id"]);
const SQLI_PARAMS = new Set(["id", "user", "user_id", "query", "search", "filter", "sort"]);
const XSS_PARAMS = new Set(["q", "search", "query", "redirect", "return", "next", "url", "message"]);
const TOKEN_PARAMS = new Set(["token", "auth", "jwt", "session", "api_key"]);

export function dedupeStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

export function normalizeEndpoint(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(text)) {
    return text.replace(/\/+$/, "");
  }

  if (text.startsWith("/")) {
    return text;
  }

  return `/${text.replace(/^\/+/, "")}`;
}

export function combineAnalysisSurface(reconData = {}, scanData = {}) {
  const endpoints = dedupeStrings([
    ...(reconData.endpoints || []),
    ...(scanData.endpoints || []),
    ...(scanData.directories || []),
  ].map(normalizeEndpoint));

  const technologies = dedupeStrings([
    ...(reconData.technologies || []),
    ...(scanData.technologies || []),
  ]);

  const services = dedupeStrings(scanData.services || []);
  const ports = [...new Set((scanData.open_ports || []).filter((port) => Number.isFinite(port)))].sort((left, right) => left - right);

  return {
    endpoints,
    technologies,
    services,
    ports,
  };
}

export function extractParameters(endpoint) {
  const text = String(endpoint || "");
  const parameters = new Set();

  try {
    const parsed = text.startsWith("http") ? new URL(text) : new URL(`https://placeholder.local${text.startsWith("/") ? text : `/${text}`}`);
    for (const [key] of parsed.searchParams.entries()) {
      parameters.add(key.toLowerCase());
    }

    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    for (let index = 0; index < pathSegments.length - 1; index += 1) {
      const segment = pathSegments[index].toLowerCase();
      const nextSegment = pathSegments[index + 1];
      if (IDOR_PARAMS.has(segment) || /^:?[a-z_]*id$/i.test(segment)) {
        parameters.add(segment.replace(/^:/, ""));
      }
      if (/^\d+$/.test(nextSegment) && /user|account|project|order|profile|id/i.test(segment)) {
        parameters.add(segment.replace(/^:/, ""));
      }
    }
  } catch {
    return [];
  }

  return [...parameters];
}

export function createCandidate({
  type,
  endpoint,
  parameter = null,
  confidence = "medium",
  severity = "medium",
  reason,
  tags = [],
  source = "heuristic",
  likelihood = null,
}) {
  return {
    type,
    endpoint: normalizeEndpoint(endpoint),
    parameter,
    confidence,
    severity,
    reason,
    tags: dedupeStrings(tags),
    source,
    likelihood: likelihood ?? calculateLikelihood(confidence, severity),
  };
}

export function calculateLikelihood(confidence, severity) {
  return (CONFIDENCE_SCORE[confidence] || 1) * 10 + (SEVERITY_SCORE[severity] || 1) * 15;
}

export function inferEndpointCandidates(endpoint) {
  const normalized = normalizeEndpoint(endpoint).toLowerCase();
  const params = extractParameters(endpoint);
  const candidates = [];

  if (/login|signin|auth/.test(normalized)) {
    candidates.push(createCandidate({
      type: "Auth Bypass",
      endpoint,
      confidence: "high",
      severity: "high",
      reason: "Authentication-related endpoint detected, which is a common target for auth bypass and access control issues.",
      tags: ["auth", "login", "high-value"],
    }));
    candidates.push(createCandidate({
      type: "CSRF",
      endpoint,
      confidence: "medium",
      severity: "medium",
      reason: "Login workflow detected; state-changing authentication flows frequently require CSRF validation.",
      tags: ["auth", "csrf"],
    }));
  }

  if (/\/api|graphql/.test(normalized)) {
    candidates.push(createCandidate({
      type: "IDOR",
      endpoint,
      confidence: "high",
      severity: "high",
      reason: "API-style endpoint detected, which increases the likelihood of object reference and authorization flaws.",
      tags: ["api", "authorization"],
    }));
  }

  if (/admin|dashboard/.test(normalized)) {
    candidates.push(createCandidate({
      type: "Auth Bypass",
      endpoint,
      confidence: "high",
      severity: "high",
      reason: "Administrative surface detected; access control weaknesses would have a high impact here.",
      tags: ["admin", "auth", "high-value"],
    }));
  }

  for (const parameter of params) {
    if (IDOR_PARAMS.has(parameter)) {
      candidates.push(createCandidate({
        type: "IDOR",
        endpoint,
        parameter,
        confidence: "high",
        severity: "high",
        reason: `Parameter '${parameter}' appears to reference direct objects or identities, which is a common IDOR indicator.`,
        tags: ["api", "idor", "object-reference"],
      }));
    }

    if (SQLI_PARAMS.has(parameter)) {
      candidates.push(createCandidate({
        type: "SQL Injection",
        endpoint,
        parameter,
        confidence: parameter === "id" ? "high" : "medium",
        severity: "high",
        reason: `Parameter '${parameter}' looks data-driven and could be vulnerable to injection if used unsafely in backend queries.`,
        tags: ["injection", "database"],
      }));
    }

    if (XSS_PARAMS.has(parameter)) {
      candidates.push(createCandidate({
        type: "XSS",
        endpoint,
        parameter,
        confidence: "medium",
        severity: "medium",
        reason: `Parameter '${parameter}' is likely reflected or rendered in responses, making XSS worth testing.`,
        tags: ["xss", "input"],
      }));
    }

    if (TOKEN_PARAMS.has(parameter)) {
      candidates.push(createCandidate({
        type: "Auth Bypass",
        endpoint,
        parameter,
        confidence: "medium",
        severity: "high",
        reason: `Sensitive parameter '${parameter}' suggests token-bearing flows that should be reviewed for authorization weaknesses.`,
        tags: ["auth", "token"],
      }));
    }
  }

  return candidates;
}

export function inferTechnologyCandidates(technologies = [], notes = []) {
  const candidates = [];
  const normalizedTechnologies = technologies.map((value) => String(value).toLowerCase());
  const normalizedNotes = notes.map((value) => String(value).toLowerCase());

  if (normalizedTechnologies.some((tech) => tech.includes("php"))) {
    candidates.push(createCandidate({
      type: "SQL Injection",
      endpoint: "/",
      confidence: "medium",
      severity: "high",
      reason: "PHP technology was detected; dynamic PHP applications often expose injection-prone parameters when input validation is weak.",
      tags: ["php", "injection"],
    }));
  }

  if (normalizedTechnologies.some((tech) => tech.includes("laravel") || tech.includes("symfony") || tech.includes("express") || tech.includes("next.js"))) {
    candidates.push(createCandidate({
      type: "IDOR",
      endpoint: "/api",
      confidence: "medium",
      severity: "high",
      reason: "Application framework suggests API-driven routes where authorization checks should be validated carefully.",
      tags: ["framework", "api"],
    }));
  }

  if (normalizedTechnologies.some((tech) => tech.includes("wordpress"))) {
    candidates.push(createCandidate({
      type: "XSS",
      endpoint: "/",
      confidence: "medium",
      severity: "medium",
      reason: "CMS technology was detected; plugin- and theme-driven surfaces often create reflected or stored XSS opportunities.",
      tags: ["cms", "xss"],
    }));
  }

  if (normalizedNotes.some((note) => note.includes("outdated") || note.includes("banner"))) {
    candidates.push(createCandidate({
      type: "Security Misconfiguration",
      endpoint: "/",
      confidence: "medium",
      severity: "medium",
      reason: "Outdated or verbose server indicators were detected, increasing the likelihood of exploitable misconfiguration and known issues.",
      tags: ["misconfig", "outdated"],
    }));
  }

  return candidates;
}

export function inferServiceCandidates(services = [], ports = []) {
  const candidates = [];
  const normalizedServices = services.map((service) => String(service).toLowerCase());

  if (normalizedServices.some((service) => service.includes("http")) && ports.some((port) => port === 80 || port === 443)) {
    candidates.push(createCandidate({
      type: "Auth Bypass",
      endpoint: "/",
      confidence: "low",
      severity: "medium",
      reason: "Web services are exposed on standard ports, so authentication and authorization surfaces should be prioritized.",
      tags: ["web", "auth"],
    }));
  }

  return candidates;
}

export function dedupeCandidates(candidates = []) {
  const seen = new Set();
  const result = [];

  for (const candidate of candidates) {
    const key = [
      candidate.type,
      normalizeEndpoint(candidate.endpoint),
      candidate.parameter || "",
      candidate.reason,
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      ...candidate,
      endpoint: normalizeEndpoint(candidate.endpoint),
    });
  }

  return result;
}

export function sortCandidates(candidates = []) {
  return [...candidates].sort((left, right) => {
    const severityDiff = (SEVERITY_SCORE[right.severity] || 0) - (SEVERITY_SCORE[left.severity] || 0);
    if (severityDiff !== 0) {
      return severityDiff;
    }

    const confidenceDiff = (CONFIDENCE_SCORE[right.confidence] || 0) - (CONFIDENCE_SCORE[left.confidence] || 0);
    if (confidenceDiff !== 0) {
      return confidenceDiff;
    }

    return (right.likelihood || 0) - (left.likelihood || 0);
  });
}

export function buildAiContext(target, reconData, scanData, heuristicCandidates) {
  return {
    target,
    recon: {
      endpoints: reconData?.endpoints || [],
      technologies: reconData?.technologies || [],
      alive_hosts: reconData?.alive_hosts || [],
    },
    scan: {
      endpoints: scanData?.endpoints || [],
      directories: scanData?.directories || [],
      services: scanData?.services || [],
      open_ports: scanData?.open_ports || [],
      technologies: scanData?.technologies || [],
      notes: scanData?.notes || [],
    },
    heuristicCandidates,
  };
}

export function normalizeAiCandidates(aiCandidates = []) {
  if (!Array.isArray(aiCandidates)) {
    return [];
  }

  return aiCandidates
    .filter((candidate) => candidate && typeof candidate === "object" && candidate.type)
    .map((candidate) =>
      createCandidate({
        type: candidate.type,
        endpoint: candidate.endpoint || "/",
        parameter: candidate.parameter || null,
        confidence: candidate.confidence || "medium",
        severity: candidate.severity || candidate.priority || "medium",
        reason: candidate.reason || "AI-assisted reasoning suggested this candidate.",
        tags: candidate.tags || ["ai"],
        source: "ai",
        likelihood: typeof candidate.likelihood === "number" ? candidate.likelihood : null,
      }),
    );
}

export function buildAnalysisPayload(target, reconData, scanData, heuristicCandidates, aiCandidates = []) {
  const merged = sortCandidates(dedupeCandidates([...heuristicCandidates, ...aiCandidates]));
  return {
    target,
    phase: "analysis",
    status: "success",
    vulnerabilities: merged,
    counts: {
      total: merged.length,
      high: merged.filter((item) => item.severity === "high").length,
      medium: merged.filter((item) => item.severity === "medium").length,
      low: merged.filter((item) => item.severity === "low").length,
    },
    summary: {
      high_value_targets: merged.filter((item) => item.tags.includes("high-value")).length,
      ai_generated: merged.filter((item) => item.source === "ai").length,
      heuristic_generated: merged.filter((item) => item.source === "heuristic").length,
    },
    recon_context: {
      endpoints: reconData?.endpoints || [],
      technologies: reconData?.technologies || [],
    },
    scan_context: {
      endpoints: scanData?.endpoints || [],
      directories: scanData?.directories || [],
      technologies: scanData?.technologies || [],
      services: scanData?.services || [],
      open_ports: scanData?.open_ports || [],
      notes: scanData?.notes || [],
    },
    generated_at: new Date().toISOString(),
  };
}

export async function writeAnalysisLog(message, meta = {}, options = {}) {
  const logFile = options.logFile || DEFAULT_LOG_FILE;
  await mkdir(path.dirname(logFile), { recursive: true });
  const suffix = Object.keys(meta).length
    ? ` ${Object.entries(meta).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ")}`
    : "";
  await appendFile(logFile, `${new Date().toISOString()} ${message}${suffix}\n`, "utf8");
}

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_FILE = path.resolve(__dirname, "..", "..", "logs", "scanner.log");
const WEB_PORTS = new Set([80, 81, 3000, 443, 591, 593, 8000, 8080, 8081, 8443, 8888]);

export function buildScannerTasks(mode = "deep") {
  const normalizedMode = String(mode || "deep").trim().toLowerCase();
  const isLight = normalizedMode === "light";

  return [
    {
      name: "port_service_scan",
      tools: [
        {
          name: "nmap",
          options: isLight
            ? { top_ports: 100, service_version: true }
            : { top_ports: 1000, service_version: true },
        },
        {
          name: "socketprobe",
          options: isLight
            ? { top_ports: 100, timeout: 4 }
            : { top_ports: 1000, timeout: 4 },
        },
      ],
      retries: 1,
      continueOnFailure: true,
    },
    {
      name: "directory_endpoint_discovery",
      tools: [
        {
          name: "ffuf",
          options: {
            wordlist: "/usr/share/wordlists/dirb/common.txt",
            match_codes: "200,204,301,302,307,401,403",
            auto_fuzz_path: true,
          },
        },
        {
          name: "dirsearch",
          options: {
            wordlist: "/usr/share/wordlists/dirb/common.txt",
            status_codes: "200,204,301,302,307,401,403",
          },
        },
        {
          name: "feroxbuster",
          options: {
            wordlist: "/usr/share/wordlists/dirb/common.txt",
            status_codes: "200,204,301,302,307,401,403",
          },
        },
        {
          name: "routeprobe",
          options: {
            timeout: isLight ? 8 : 12,
          },
        },
      ],
      retries: 1,
      continueOnFailure: true,
    },
    {
      name: "web_server_scan",
      tools: [
        {
          name: "nikto",
          options: isLight ? { timeout: 30 } : { timeout: 60 },
        },
      ],
      retries: 0,
      continueOnFailure: true,
    },
  ];
}

export function dedupeStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

export function normalizeUrl(value) {
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

  return `https://${text}`.replace(/\/+$/, "");
}

export function findTaskResult(phaseResult, taskName) {
  return phaseResult?.tasks?.find((task) => task.name === taskName) || null;
}

export function extractReconHosts(reconData, target) {
  const aliveHosts = reconData?.alive_hosts || [];
  const subdomains = reconData?.subdomains || [];
  return dedupeStrings(
    (aliveHosts.length > 0 ? aliveHosts : (subdomains.length > 0 ? subdomains : [target]))
      .map(normalizeUrl),
  );
}

export function extractSeedEndpoints(reconData) {
  return dedupeStrings((reconData?.endpoints || []).map(normalizeUrl));
}

export function aggregatePorts(phaseResult) {
  const task = findTaskResult(phaseResult, "port_service_scan");
  const openPorts = [];
  const services = [];
  const serviceMap = new Map();

  for (const attempt of task?.attempts || []) {
    for (const port of attempt.result?.data?.open_ports || []) {
      openPorts.push(port);
    }

    for (const service of attempt.result?.data?.services || []) {
      services.push(service);
    }

    for (const detail of attempt.result?.data?.port_details || []) {
      const key = `${detail.port}/${detail.protocol || "tcp"}/${detail.service || ""}`;
      serviceMap.set(key, detail);
    }
  }

  return {
    open_ports: [...new Set(openPorts)].sort((left, right) => left - right),
    services: dedupeStrings(services),
    port_details: [...serviceMap.values()],
  };
}

export function hasWebSurface(reconData, phaseResult) {
  const reconHosts = (reconData?.alive_hosts || []).length > 0 || (reconData?.endpoints || []).length > 0;
  const portSummary = aggregatePorts(phaseResult);
  const serviceNames = new Set(portSummary.services.map((service) => service.toLowerCase()));
  const httpLikeService = [...serviceNames].some((service) => service.includes("http"));
  const webPort = portSummary.open_ports.some((port) => WEB_PORTS.has(port));

  return reconHosts || httpLikeService || webPort;
}

export function buildDirectoryTargets(reconData, phaseResult, target) {
  const hosts = extractReconHosts(reconData, target);
  const seededEndpoints = extractSeedEndpoints(reconData);
  const targets = [...hosts];

  for (const endpoint of seededEndpoints) {
    if (/^https?:\/\//i.test(endpoint)) {
      targets.push(endpoint);
      continue;
    }

    for (const host of hosts) {
      targets.push(`${host}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);
    }
  }

  return dedupeStrings(targets.map(normalizeUrl));
}

export function aggregateDirectoryDiscovery(phaseResult) {
  const task = findTaskResult(phaseResult, "directory_endpoint_discovery");
  const directories = [];
  const endpoints = [];
  const tagged = [];

  for (const attempt of task?.attempts || []) {
    for (const match of attempt.result?.data?.matches || []) {
      const endpoint = normalizeUrl(match.url || match.path);
      if (endpoint) {
        endpoints.push(endpoint);
        tagged.push(tagEndpoint(endpoint));
      }
    }

    for (const directory of attempt.result?.data?.directories || []) {
      const normalized = normalizeUrl(directory);
      if (normalized) {
        directories.push(normalized);
      }
    }

    for (const path of attempt.result?.data?.paths || []) {
      const normalized = normalizeUrl(path);
      if (normalized) {
        directories.push(normalized);
      }
    }
  }

  return {
    directories: dedupeStrings(directories),
    endpoints: dedupeStrings(endpoints),
    endpoint_tags: tagged.filter(Boolean),
  };
}

export function aggregateNikto(phaseResult) {
  const task = findTaskResult(phaseResult, "web_server_scan");
  const findings = [];
  const notes = [];

  for (const attempt of task?.attempts || []) {
    findings.push(...(attempt.result?.data?.findings || []));
    notes.push(...(attempt.result?.data?.notes || []));
  }

  return {
    findings,
    notes: dedupeStrings(notes),
  };
}

export function collectFailures(phaseResult) {
  const failures = [];

  for (const task of phaseResult?.tasks || []) {
    if (task.status === "failed") {
      failures.push({
        task: task.name,
        reason: task.error || "Task failed.",
        toolsTried: (task.attempts || []).map((attempt) => attempt.tool),
      });
    }
  }

  return failures;
}

export function buildScanNotes({ reconData, ports, discovery, nikto }) {
  const notes = [];

  for (const endpoint of discovery.endpoints) {
    const tag = tagEndpoint(endpoint);
    if (tag === "login") {
      notes.push("Login page detected");
    }
    if (tag === "api") {
      notes.push("API endpoint found");
    }
    if (tag === "admin") {
      notes.push("Admin surface detected");
    }
  }

  if ((reconData?.technologies || []).some((tech) => /graphql/i.test(tech))) {
    notes.push("GraphQL-related technology detected");
  }

  if (ports.services.some((service) => /http/i.test(service))) {
    notes.push("HTTP service detected");
  }

  notes.push(...nikto.notes);
  return dedupeStrings(notes);
}

export function buildScannerPayload(target, mode, reconData, phaseResult) {
  const ports = aggregatePorts(phaseResult);
  const discovery = aggregateDirectoryDiscovery(phaseResult);
  const nikto = aggregateNikto(phaseResult);
  const failures = collectFailures(phaseResult);
  const notes = buildScanNotes({ reconData, ports, discovery, nikto });
  const hasFailures = (phaseResult.summary?.failedTasks || 0) > 0;
  const hasData = ports.open_ports.length > 0 || discovery.endpoints.length > 0 || discovery.directories.length > 0;
  const degraded = !hasData;

  if (degraded) {
    notes.push("limited data available");
  }

  return {
    target,
    mode,
    phase: "scan",
    status: phaseResult.status === "error"
      ? "error"
      : hasFailures
        ? "partial"
        : hasData
          ? "success"
          : "partial",
    source_recon_status: reconData?.status || "unknown",
    hosts_scanned: extractReconHosts(reconData, target),
    open_ports: ports.open_ports,
    services: ports.services,
    port_details: ports.port_details,
    directories: discovery.directories,
    endpoints: discovery.endpoints,
    endpoint_tags: discovery.endpoint_tags,
    technologies: dedupeStrings([...(reconData?.technologies || [])]),
    notes,
    scan_mode: degraded ? "degraded" : "standard",
    note: degraded ? "limited data available" : undefined,
    nikto_findings: nikto.findings,
    failures,
    summary: phaseResult.summary,
    tasks: phaseResult.tasks,
    task_results: phaseResult.tasks,
    generated_at: new Date().toISOString(),
  };
}

export function tagEndpoint(value) {
  const text = String(value || "").toLowerCase();
  if (!text) {
    return null;
  }
  if (text.includes("login") || text.includes("signin") || text.includes("auth")) {
    return "login";
  }
  if (text.includes("/api") || text.includes("graphql")) {
    return "api";
  }
  if (text.includes("admin") || text.includes("dashboard")) {
    return "admin";
  }
  return "general";
}

export async function writeScannerLog(message, meta = {}, options = {}) {
  const logFile = options.logFile || DEFAULT_LOG_FILE;
  await mkdir(path.dirname(logFile), { recursive: true });
  const suffix = Object.keys(meta).length
    ? ` ${Object.entries(meta).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ")}`
    : "";
  await appendFile(logFile, `${new Date().toISOString()} ${message}${suffix}\n`, "utf8");
}

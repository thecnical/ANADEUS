import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_FILE = path.resolve(__dirname, "..", "..", "logs", "recon_agent.log");

export function buildReconTasks(mode = "deep") {
  const normalizedMode = String(mode || "deep").trim().toLowerCase();
  const isLight = normalizedMode === "light";

  return [
    {
      name: "subdomain_enumeration",
      tools: isLight ? ["subfinder", "assetfinder"] : ["subfinder", "amass", "assetfinder"],
      retries: 1,
      continueOnFailure: true,
    },
    {
      name: "alive_host_detection",
      tools: ["httpx", "webprobe"],
      options: {
        tech_detect: true,
        title: true,
        status_code: true,
        follow_redirects: true,
        threads: isLight ? 25 : 100,
      },
      retries: 1,
      continueOnFailure: true,
    },
    {
      name: "technology_detection",
      tools: ["whatweb", "webprobe"],
      options: {
        aggression: isLight ? 1 : 3,
      },
      retries: 0,
      continueOnFailure: true,
    },
    {
      name: "endpoint_discovery",
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
          name: "routeprobe",
          options: {
            timeout: isLight ? 8 : 12,
          },
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

export function findTaskResult(phaseResult, taskName) {
  return phaseResult?.tasks?.find((task) => task.name === taskName) || null;
}

export function aggregateSubdomains(phaseResult, target) {
  const task = findTaskResult(phaseResult, "subdomain_enumeration");
  const subdomains = [];

  for (const attempt of task?.attempts || []) {
    const entries = attempt.result?.data?.subdomains || [];
    for (const entry of entries) {
      subdomains.push(entry);
    }
  }

  if (subdomains.length === 0) {
    subdomains.push(target);
  }

  return dedupeStrings(subdomains);
}

export function aggregateAliveHosts(phaseResult) {
  const task = findTaskResult(phaseResult, "alive_host_detection");
  const aliveHosts = [];
  const ipMap = {};
  const titles = {};

  for (const attempt of task?.attempts || []) {
    for (const host of attempt.result?.data?.alive_hosts || []) {
      const url = host.url || host.host;
      if (!url) {
        continue;
      }

      aliveHosts.push(url);

      if (host.ip) {
        ipMap[url] = host.ip;
      }

      if (host.title) {
        titles[url] = host.title;
      }
    }
  }

  return {
    alive_hosts: dedupeStrings(aliveHosts),
    ip_map: ipMap,
    titles,
  };
}

export function aggregateTechnologies(phaseResult) {
  const technologies = [];

  for (const taskName of ["alive_host_detection", "technology_detection"]) {
    const task = findTaskResult(phaseResult, taskName);
    for (const attempt of task?.attempts || []) {
      for (const technology of attempt.result?.data?.technologies || []) {
        technologies.push(technology);
      }

      for (const finding of attempt.result?.data?.findings || []) {
        for (const plugin of finding.plugins || []) {
          if (plugin.name) {
            technologies.push(plugin.name);
          }
        }
      }
    }
  }

  return dedupeStrings(technologies);
}

export function aggregateEndpoints(phaseResult) {
  const task = findTaskResult(phaseResult, "endpoint_discovery");
  const endpoints = [];

  for (const attempt of task?.attempts || []) {
    for (const match of attempt.result?.data?.matches || []) {
      const endpoint = match.url || match.path;
      if (endpoint) {
        endpoints.push(endpoint);
      }
    }
  }

  return dedupeStrings(endpoints);
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

export function buildReconPayload(target, mode, phaseResult) {
  const subdomains = aggregateSubdomains(phaseResult, target);
  const alive = aggregateAliveHosts(phaseResult);
  const hasFailures = (phaseResult.summary?.failedTasks || 0) > 0;
  const hasData = subdomains.length > 0 || alive.alive_hosts.length > 0;

  return {
    target,
    mode,
    phase: "recon",
    status: phaseResult.status === "error"
      ? "error"
      : hasFailures
        ? "partial"
        : hasData
          ? "success"
          : "partial",
    subdomains,
    alive_hosts: alive.alive_hosts,
    technologies: aggregateTechnologies(phaseResult),
    endpoints: aggregateEndpoints(phaseResult),
    ip_map: alive.ip_map,
    titles: alive.titles,
    failures: collectFailures(phaseResult),
    summary: phaseResult.summary,
    tasks: phaseResult.tasks,
    task_results: phaseResult.tasks,
    generated_at: new Date().toISOString(),
  };
}

export async function writeReconLog(message, meta = {}, options = {}) {
  const logFile = options.logFile || DEFAULT_LOG_FILE;
  await mkdir(path.dirname(logFile), { recursive: true });
  const suffix = Object.keys(meta).length
    ? ` ${Object.entries(meta).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ")}`
    : "";
  await appendFile(logFile, `${new Date().toISOString()} ${message}${suffix}\n`, "utf8");
}

const PRIORITY_BONUS = {
  auth: 18,
  "high-value": 15,
  api: 12,
  authorization: 12,
  injection: 10,
  database: 8,
  admin: 10,
};

export function deriveContextSignals(context = {}) {
  const reconEndpoints = context.recon?.endpoints || [];
  const scanEndpoints = context.scan?.endpoints || [];
  const scanDirectories = context.scan?.directories || [];
  const technologies = [
    ...(context.recon?.technologies || []),
    ...(context.scan?.technologies || []),
  ].map((value) => String(value).toLowerCase());
  const services = (context.scan?.services || []).map((value) => String(value).toLowerCase());
  const openPorts = context.scan?.open_ports || [];
  const vulnerabilities = context.analysis?.vulnerabilities || [];

  const allPaths = [...reconEndpoints, ...scanEndpoints, ...scanDirectories]
    .map((value) => String(value).toLowerCase());

  return {
    hasApiSurface: allPaths.some((value) => value.includes("/api") || value.includes("graphql")),
    hasLoginSurface: allPaths.some((value) => value.includes("login") || value.includes("signin") || value.includes("auth")),
    hasAdminSurface: allPaths.some((value) => value.includes("admin") || value.includes("dashboard")),
    hasWebSurface: (context.recon?.alive_hosts?.length || 0) > 0
      || allPaths.length > 0
      || services.some((service) => service.includes("http"))
      || openPorts.some((port) => [80, 443, 8080, 8443].includes(port)),
    hasAliveHosts: (context.recon?.alive_hosts?.length || 0) > 0,
    hasOpenPorts: openPorts.length > 0,
    hasFindings: vulnerabilities.length > 0 || (context.exploit?.confirmed_vulnerabilities?.length || 0) > 0,
    likelyApiFramework: technologies.some((tech) => tech.includes("laravel") || tech.includes("express") || tech.includes("graphql") || tech.includes("fastapi")),
    likelyDynamicBackend: technologies.some((tech) => tech.includes("php") || tech.includes("node") || tech.includes("python") || tech.includes("java")),
    exploitConfirmedCount: context.exploit?.confirmed_vulnerabilities?.length || 0,
    vulnerabilityCount: vulnerabilities.length,
  };
}

export function calculateDataQualityScore(context = {}) {
  const reconScore = scoreCount(context.recon?.subdomains?.length || 0, 20)
    + scoreCount(context.recon?.alive_hosts?.length || 0, 20)
    + scoreCount(context.recon?.technologies?.length || 0, 10)
    + scoreCount(context.recon?.endpoints?.length || 0, 10);
  const scanScore = scoreCount(context.scan?.endpoints?.length || 0, 15)
    + scoreCount(context.scan?.directories?.length || 0, 10)
    + scoreCount(context.scan?.open_ports?.length || 0, 10)
    + scoreCount(context.scan?.services?.length || 0, 5);

  return normalizeScore(reconScore + scanScore, 100);
}

export function scoreCandidateConfidence(candidate = {}, context = {}) {
  const tags = Array.isArray(candidate.tags) ? candidate.tags : [];
  const type = String(candidate.type || "").toLowerCase();
  const endpoint = String(candidate.endpoint || "").toLowerCase();
  const parameter = String(candidate.parameter || "").toLowerCase();
  const dataQuality = calculateDataQualityScore(context);
  const signals = deriveContextSignals(context);

  let score = dataQuality * 0.35;
  score += endpoint ? 15 : 0;
  score += candidate.reason ? 10 : 0;
  score += parameter ? 8 : 0;
  score += keywordScore(tags, PRIORITY_BONUS) * 0.9;

  if (signals.hasApiSurface && (type.includes("idor") || tags.includes("api"))) {
    score += 14;
  }

  if (signals.hasLoginSurface && (type.includes("auth") || type.includes("csrf") || tags.includes("auth"))) {
    score += 16;
  }

  if (signals.hasAdminSurface && endpoint.includes("admin")) {
    score += 12;
  }

  if (!signals.hasWebSurface && (type.includes("xss") || type.includes("csrf") || type.includes("auth"))) {
    score -= 18;
  }

  if (!signals.hasApiSurface && type.includes("idor")) {
    score -= 12;
  }

  if (!signals.likelyDynamicBackend && type.includes("sql")) {
    score -= 8;
  }

  return normalizeScore(score, 1);
}

export function reduceFalsePositives(candidates = [], context = {}) {
  return candidates
    .map((candidate) => {
      const confidenceScore = scoreCandidateConfidence(candidate, context);
      return {
        ...candidate,
        confidence_score: confidenceScore,
        likelihood: typeof candidate.likelihood === "number"
          ? Math.max(candidate.likelihood, Math.round(confidenceScore * 100))
          : Math.round(confidenceScore * 100),
      };
    })
    .filter((candidate) => candidate.confidence_score >= minimumConfidence(candidate));
}

export function prioritizeCandidates(candidates = [], context = {}) {
  return [...candidates].sort((left, right) => {
    const rightScore = scoreCandidateConfidence(right, context);
    const leftScore = scoreCandidateConfidence(left, context);
    return rightScore - leftScore;
  });
}

export function prioritizeTargets(context = {}) {
  const signals = deriveContextSignals(context);
  const targets = [];

  if (signals.hasAdminSurface) {
    targets.push({ label: "admin surfaces", priority: "high" });
  }
  if (signals.hasLoginSurface) {
    targets.push({ label: "authentication workflows", priority: "high" });
  }
  if (signals.hasApiSurface) {
    targets.push({ label: "API endpoints", priority: "high" });
  }
  if (signals.hasOpenPorts) {
    targets.push({ label: "exposed services", priority: "medium" });
  }

  return targets;
}

export function optimizeTasksForPhase(phase, tasks = [], context = {}, mode = "deep") {
  const normalizedPhase = String(phase || "").toLowerCase();
  const signals = deriveContextSignals(context);
  const reasoning = [];
  let optimizedTasks = structuredClone(tasks);

  if (normalizedPhase === "scan") {
    if (!signals.hasWebSurface) {
      optimizedTasks = optimizedTasks.filter((task) => task.name === "port_service_scan");
      reasoning.push("Skipped web discovery tasks because no web surface was detected in recon context.");
    } else {
      optimizedTasks = optimizedTasks.map((task) => optimizeScanTask(task, signals, mode));
      if (signals.hasApiSurface) {
        optimizedTasks = reorderTasks(optimizedTasks, ["port_service_scan", "directory_endpoint_discovery", "web_server_scan"]);
        reasoning.push("Prioritized content discovery because API-style endpoints were detected.");
      }
      if (signals.hasLoginSurface) {
        reasoning.push("Login-related paths were detected, so auth-sensitive content discovery remains enabled.");
      }
    }
  }

  if (normalizedPhase === "recon") {
    if (signals.hasAliveHosts && (context.recon?.subdomains?.length || 0) > 10 && mode === "light") {
      optimizedTasks = optimizedTasks.filter((task) => task.name !== "technology_detection");
      reasoning.push("Skipped separate technology detection in light mode because http probing already captured technology hints.");
    }
  }

  return {
    tasks: optimizedTasks,
    reasoning,
    skipped: tasks
      .map((task) => task.name)
      .filter((taskName) => !optimizedTasks.some((task) => task.name === taskName)),
    signals,
  };
}

function optimizeScanTask(task, signals, mode) {
  if (task.name !== "directory_endpoint_discovery") {
    return task;
  }

  const nextTask = structuredClone(task);
  nextTask.tools = nextTask.tools.map((tool) => {
    const normalizedTool = typeof tool === "string" ? { name: tool } : { ...tool };
    if (normalizedTool.name !== "ffuf") {
      return normalizedTool;
    }

    normalizedTool.options = {
      ...(normalizedTool.options || {}),
      auto_fuzz_path: true,
      match_codes: signals.hasLoginSurface
        ? "200,204,301,302,307,401,403"
        : "200,204,301,302,307,403",
      recursion: signals.hasApiSurface && mode !== "light",
    };
    return normalizedTool;
  });

  return nextTask;
}

function reorderTasks(tasks, preferredOrder) {
  const orderMap = new Map(preferredOrder.map((name, index) => [name, index]));
  return [...tasks].sort((left, right) => {
    const leftOrder = orderMap.has(left.name) ? orderMap.get(left.name) : 999;
    const rightOrder = orderMap.has(right.name) ? orderMap.get(right.name) : 999;
    return leftOrder - rightOrder;
  });
}

function minimumConfidence(candidate) {
  const type = String(candidate.type || "").toLowerCase();
  if (type.includes("idor") || type.includes("auth") || type.includes("sql")) {
    return 0.45;
  }
  return 0.4;
}

function scoreCount(count, maxContribution) {
  return Math.min(maxContribution, count * (maxContribution / 5));
}

function keywordScore(values, weights) {
  return (values || []).reduce((sum, value) => sum + (weights[String(value).toLowerCase()] || 0), 0);
}

function normalizeScore(value, scale = 1) {
  if (scale === 1) {
    return Math.max(0, Math.min(1, Number((value / 100).toFixed(2))));
  }

  return Math.max(0, Math.min(scale, Number(value.toFixed(2))));
}

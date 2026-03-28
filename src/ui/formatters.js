import chalk from "chalk";

export function formatCliResponse(response, { json } = {}) {
  if (json) {
    return JSON.stringify(response, null, 2);
  }

  if (response?.error && (response?.type === "error" || !response?.summary && !response?.results)) {
    return `${chalk.redBright("[error]")} ${response.error}`;
  }

  const lines = [];

  if (response.type === "agent" || response.type === "phase" || response.type === "test") {
    lines.push(formatSectionHeader(response.summary || "ANADEUS Result"));
  } else if (response.summary) {
    lines.push(response.summary);
  }

  if (response.phase) {
    lines.push(displayProgress(response.phase, normalizeStatus(response.data?.status || response.status || "running")));
  }

  if (Array.isArray(response.progress) && response.progress.length > 0) {
    lines.push(response.progress.map((item) => displayProgress(item.phase, item.status)).join(` ${chalk.dim("->")} `));
  }

  pushKeyValue(lines, "message", response.message);
  pushKeyValue(lines, "agent", response.agent);
  pushKeyValue(lines, "target", response.target);
  pushKeyValue(lines, "command", response.command ? `/${response.command}` : null);
  pushKeyValue(lines, "subject", response.subject);
  pushKeyValue(lines, "workspace", response.workspace);
  pushKeyValue(lines, "file", response.location);

  if (response.data) {
    appendDataSummary(lines, response.data);
  }

  if (response.summary && typeof response.summary === "object" && !Array.isArray(response.summary)) {
    lines.push("");
    lines.push(formatSectionHeader("Results Summary"));
    for (const [phaseName, status] of Object.entries(response.summary)) {
      lines.push(displayProgress(phaseName, status));
    }
  }

  if (Array.isArray(response.phases) && response.phases.length > 0) {
    lines.push("");
    lines.push(formatSectionHeader("Phase Results"));
    for (const phase of response.phases) {
      lines.push(displayProgress(phase.phase, phase.status));
    }
  }

  if (Array.isArray(response.results) && response.results.length > 0) {
    lines.push("");
    lines.push(formatSectionHeader("Validation"));
    for (const result of response.results) {
      const entry = displayProgress(result.phase, result.status);
      lines.push(result.issue ? `${entry} ${chalk.dim(`- ${result.issue}`)}` : entry);
    }
  }

  if (Array.isArray(response.next) && response.next.length > 0) {
    lines.push("");
    lines.push(formatSectionHeader("Next Actions"));
    for (const item of response.next) {
      lines.push(`${chalk.cyanBright("•")} ${item}`);
    }
  }

  if (Array.isArray(response.supportedCommands) && response.supportedCommands.length > 0) {
    lines.push("");
    lines.push(formatSectionHeader("Supported Commands"));
    lines.push(chalk.yellow(response.supportedCommands.join(", ")));
  }

  if (Array.isArray(response.hints) && response.hints.length > 0) {
    lines.push("");
    lines.push(formatSectionHeader("Hints"));
    lines.push(chalk.dim(response.hints.join(", ")));
  }

  return lines.filter((line, index, collection) => !(line === "" && collection[index - 1] === "")).join("\n");
}

export function displayProgress(phase, status) {
  const normalizedStatus = normalizeStatus(status);
  const icon = statusIcon(normalizedStatus);
  const colorize = statusColor(normalizedStatus);
  return colorize(`[${capitalize(phase)} ${icon}]`);
}

function appendDataSummary(lines, data) {
  const summaryEntries = extractDataSummary(data);
  if (summaryEntries.length === 0) {
    return;
  }

  lines.push("");
  lines.push(formatSectionHeader("Results Summary"));
  for (const entry of summaryEntries) {
    lines.push(`${chalk.yellow(`${entry.label}:`)} ${chalk.green(String(entry.value))}`);
  }

  if (data?.summary) {
    lines.push(`${chalk.yellow("tasks:")} ${chalk.green(`${data.summary.successfulTasks}/${data.summary.totalTasks} successful`)}`);
    lines.push(`${chalk.yellow("progress:")} ${chalk.green(`${data.summary.progress}%`)}`);
  }
}

function extractDataSummary(data) {
  const fields = [
    ["status", data.status],
    ["subdomains", data.subdomains?.length],
    ["alive hosts", data.alive_hosts?.length],
    ["technologies", data.technologies?.length],
    ["endpoints", data.endpoints?.length],
    ["directories", data.directories?.length],
    ["open ports", data.open_ports?.length],
    ["vulnerabilities", data.vulnerabilities?.length],
    ["confirmed", data.confirmed_vulnerabilities?.length],
    ["reports", data.reports?.length],
    ["current phase", data.phase],
  ];

  return fields
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => ({ label, value }));
}

function pushKeyValue(lines, label, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  lines.push(`${chalk.yellow(`${label}:`)} ${value}`);
}

function formatSectionHeader(title) {
  return chalk.cyanBright.bold(`== ${title} ==`);
}

function statusColor(status) {
  if (status === "success" || status === "completed" || status === "pass") {
    return chalk.greenBright.bold;
  }

  if (status === "warning" || status === "partial") {
    return chalk.yellowBright.bold;
  }

  if (status === "failed" || status === "error" || status === "fail") {
    return chalk.redBright.bold;
  }

  return chalk.cyanBright.bold;
}

function statusIcon(status) {
  if (status === "success" || status === "completed" || status === "pass") {
    return "\u2713";
  }

  if (status === "warning" || status === "partial") {
    return "!";
  }

  if (status === "failed" || status === "error" || status === "fail") {
    return "x";
  }

  if (status === "running") {
    return "~";
  }

  return " ";
}

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "success") {
    return "completed";
  }
  return normalized;
}

function capitalize(value) {
  const text = String(value || "");
  return text ? `${text.slice(0, 1).toUpperCase()}${text.slice(1)}` : text;
}

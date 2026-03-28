import chalk from "chalk";
import {
  APP_CREDIT,
  APP_SLOGAN,
  APP_STATUS,
  APP_TITLE,
  APP_VERSION,
  DEFAULT_MODE_LABEL,
} from "../config/defaults.js";

const ASCII_BANNER = [
  "   ___   _   _    _    ____  _____ _   _ ____  ",
  "  / _ \\ | \\ | |  / \\  |  _ \\| ____| | | / ___| ",
  " | | | ||  \\| | / _ \\ | | | |  _| | | | \\___ \\ ",
  " | |_| || |\\  |/ ___ \\| |_| | |___| |_| |___) |",
  "  \\___/ |_| \\_/_/   \\_\\____/|_____|\\___/|____/ ",
];

const STATUS_LINES = [
  "[OK] System Initialized",
  "[OK] Agents Ready",
  "[OK] Awaiting Command...",
];

const BANNER_WIDTH = Math.max(
  ...ASCII_BANNER.map((line) => line.length),
  APP_TITLE.length,
  APP_SLOGAN.length,
);
const SCAN_PANEL_WIDTH = 68;

function visibleLength(value) {
  return String(value).replace(/\x1B\[[0-9;]*m/g, "").length;
}

function padLine(content, width) {
  const text = String(content);
  const padding = Math.max(0, width - visibleLength(text));
  return `${text}${" ".repeat(padding)}`;
}

function centerLine(content, width = BANNER_WIDTH) {
  const text = String(content);
  const visible = visibleLength(text);
  const left = Math.max(0, Math.floor((width - visible) / 2));
  const right = Math.max(0, width - visible - left);
  return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
}

function createPanelBorder() {
  return chalk.blueBright(`+${"-".repeat(SCAN_PANEL_WIDTH - 2)}+`);
}

function createPanelTitle(title) {
  const content = centerLine(chalk.cyanBright.bold(title), SCAN_PANEL_WIDTH - 4);
  return `| ${content} |`;
}

function createPanelRow(label, value) {
  const content = `${chalk.yellow.bold(`${label}:`)} ${chalk.green(value)}`;
  return `| ${padLine(content, SCAN_PANEL_WIDTH - 4)} |`;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatReadyStatus(blinkStatus) {
  const styled = chalk.green.bold(APP_STATUS);
  return blinkStatus ? `\x1B[5m${styled}\x1B[25m` : styled;
}

async function printWithDelay(text, delayMs) {
  const lines = String(text).split("\n");

  for (const line of lines) {
    process.stdout.write(`${line}\n`);
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
}

export function buildBanner({ blinkStatus = true } = {}) {
  const details =
    `${chalk.yellow.bold("Mode:")} ${chalk.green(DEFAULT_MODE_LABEL)}   ` +
    `${chalk.yellow.bold("Status:")} ${formatReadyStatus(blinkStatus)}   ` +
    `${chalk.yellow.bold("Version:")} ${chalk.green(APP_VERSION)}`;

  return [
    ...ASCII_BANNER.map((line) => centerLine(chalk.cyanBright.bold(line))),
    "",
    centerLine(chalk.white.bold(APP_TITLE)),
    centerLine(chalk.red.bold(APP_SLOGAN)),
    "",
    centerLine(details),
    "",
    centerLine(chalk.magenta(APP_CREDIT)),
  ].join("\n");
}

export function buildSystemStatus() {
  return STATUS_LINES.map((line) => {
    const highlighted = line.replace("[OK]", chalk.green("[OK]"));
    return chalk.white(highlighted);
  }).join("\n");
}

export function buildScanInfo(target, phase, mode) {
  const resolvedTarget = String(target || "N/A");
  const resolvedPhase = String(phase || "Initialization");
  const resolvedMode = String(mode || "Chat").trim() || "Chat";

  return [
    createPanelBorder(),
    createPanelTitle("ANADEUS SCAN PANEL"),
    createPanelBorder(),
    createPanelRow("Target", resolvedTarget),
    createPanelRow("Current Phase", resolvedPhase),
    createPanelRow("Mode", resolvedMode),
    createPanelBorder(),
  ].join("\n");
}

export async function displayBanner(options = {}) {
  const {
    animate = process.stdout.isTTY && process.env.CI !== "true",
    delayMs = 30,
    blinkStatus = true,
  } = options;
  const banner = buildBanner({ blinkStatus });

  if (animate) {
    await printWithDelay(banner, delayMs);
    return;
  }

  process.stdout.write(`${banner}\n`);
}

export function displaySystemStatus() {
  process.stdout.write(`${buildSystemStatus()}\n`);
}

export function displayScanInfo(target, phase, mode) {
  process.stdout.write(`${buildScanInfo(target, phase, mode)}\n`);
}

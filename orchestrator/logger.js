import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = path.resolve(__dirname, "..", "logs");
const DEFAULT_LOG_FILE = path.join(DEFAULT_LOG_DIR, "system.log");

function serializeMeta(meta = {}) {
  return Object.entries(meta)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
}

export function createOrchestratorLogger(options = {}) {
  const logFile = options.logFile || DEFAULT_LOG_FILE;
  const logDir = path.dirname(logFile);

  async function write(level, message, meta = {}) {
    await mkdir(logDir, { recursive: true });
    const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${meta && Object.keys(meta).length ? ` ${serializeMeta(meta)}` : ""}\n`;
    await appendLogLine(logFile, line);
  }

  return {
    info(message, meta) {
      return write("info", message, meta);
    },
    warn(message, meta) {
      return write("warn", message, meta);
    },
    error(message, meta) {
      return write("error", message, meta);
    },
    logFile,
  };
}

async function appendLogLine(filePath, content) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(filePath, content, "utf8");
}

export function getDefaultLogFile() {
  return DEFAULT_LOG_FILE;
}

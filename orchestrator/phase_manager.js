import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_WORKSPACE_ROOT = path.join(REPO_ROOT, "workspace");

export const PHASES = ["recon", "scan", "analysis", "exploit", "poc", "impact", "report"];

export function getWorkspaceRoot(options = {}) {
  return options.workspaceRoot || process.env.ANADEUS_WORKSPACE_ROOT || DEFAULT_WORKSPACE_ROOT;
}

export function normalizePhase(phase) {
  return String(phase || "").trim().toLowerCase();
}

export function validatePhase(phase) {
  const normalized = normalizePhase(phase);
  if (!PHASES.includes(normalized)) {
    throw new Error(`Invalid phase '${phase}'. Supported phases: ${PHASES.join(", ")}.`);
  }
  return normalized;
}

export function getPreviousPhase(phase) {
  const normalized = validatePhase(phase);
  const index = PHASES.indexOf(normalized);
  return index > 0 ? PHASES[index - 1] : null;
}

export function sanitizeTargetForWorkspace(target) {
  const normalized = String(target || "").trim();
  if (!normalized) {
    throw new Error("Target is required.");
  }

  const sanitized = normalized.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  if (!sanitized) {
    throw new Error("Target produced an invalid workspace path.");
  }

  return sanitized.toLowerCase();
}

export function getTargetWorkspacePath(target, options = {}) {
  return path.join(getWorkspaceRoot(options), sanitizeTargetForWorkspace(target));
}

export function getMetaFilePath(target, options = {}) {
  return path.join(getTargetWorkspacePath(target, options), "meta.json");
}

export function getPhaseDirectory(target, phase, options = {}) {
  return path.join(getTargetWorkspacePath(target, options), validatePhase(phase));
}

export function getPhaseFilePath(target, phase, options = {}) {
  const normalized = validatePhase(phase);
  return path.join(getPhaseDirectory(target, normalized, options), `${normalized}.json`);
}

export async function ensureWorkspaceStructure(target, options = {}) {
  const workspacePath = getTargetWorkspacePath(target, options);
  await mkdir(workspacePath, { recursive: true });

  await Promise.all(
    PHASES.map(async (phase) => {
      await mkdir(getPhaseDirectory(target, phase, options), { recursive: true });
    }),
  );

  const meta = await loadMeta(target, options);
  if (!meta.target) {
    meta.target = String(target);
    meta.workspace = workspacePath;
    meta.createdAt = new Date().toISOString();
    meta.updatedAt = meta.createdAt;
    meta.phases = meta.phases || {};
    await saveMeta(target, meta, options);
  }

  return workspacePath;
}

export async function loadMeta(target, options = {}) {
  const metaFilePath = getMetaFilePath(target, options);
  return readJsonFile(metaFilePath, {
    target: String(target || ""),
    workspace: getTargetWorkspacePath(target, options),
    createdAt: null,
    updatedAt: null,
    activePhase: null,
    completedPhases: [],
    phases: {},
  });
}

export async function saveMeta(target, meta, options = {}) {
  const metaFilePath = getMetaFilePath(target, options);
  const nextMeta = {
    ...meta,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(metaFilePath, nextMeta);
  return nextMeta;
}

export async function loadPhaseData(target, phase, options = {}) {
  const filePath = getPhaseFilePath(target, phase, options);
  return readJsonFile(filePath, null);
}

export async function savePhaseData(target, phase, data, options = {}) {
  const normalized = validatePhase(phase);
  const filePath = getPhaseFilePath(target, normalized, options);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeJsonFile(filePath, data);
  return filePath;
}

export async function markPhaseComplete(target, phase, options = {}) {
  const normalized = validatePhase(phase);
  const meta = await loadMeta(target, options);
  const completedPhases = normalizeCompletedPhases(meta.completedPhases);

  if (!completedPhases.includes(normalized)) {
    completedPhases.push(normalized);
  }

  meta.completedPhases = completedPhases;
  await saveMeta(target, meta, options);
  return meta.completedPhases;
}

export async function updatePhaseState(target, phase, newState, options = {}) {
  const normalized = validatePhase(phase);
  const meta = await loadMeta(target, options);

  // HARD RESET - NO MERGE
  const cleanState = {
    status: newState.status || "unknown",
    updated_at: Date.now(),
  };

  meta.phases = meta.phases || {};
  meta.phases[normalized] = cleanState;

  return saveMeta(target, meta, options);
}

export function summarizeTaskResults(taskResults = []) {
  const summary = {
    totalTasks: taskResults.length,
    successfulTasks: 0,
    failedTasks: 0,
    skippedTasks: 0,
  };

  for (const task of taskResults) {
    if (task.status === "success") {
      summary.successfulTasks += 1;
    } else if (task.status === "skipped") {
      summary.skippedTasks += 1;
    } else {
      summary.failedTasks += 1;
    }
  }

  summary.progress = summary.totalTasks === 0
    ? 0
    : Number((((summary.successfulTasks + summary.skippedTasks) / summary.totalTasks) * 100).toFixed(2));

  return summary;
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallbackValue;
    }

    // Concurrent phase updates write files atomically, but a short retry makes reads
    // more resilient when multiple processes touch the same workspace at once.
    if (error.name === "SyntaxError") {
      try {
        await new Promise((resolve) => setTimeout(resolve, 25));
        const content = await readFile(filePath, "utf8");
        return JSON.parse(content);
      } catch (retryError) {
        if (retryError.code === "ENOENT") {
          return fallbackValue;
        }
        throw new Error(`Failed to read JSON file '${filePath}': ${retryError.message}`);
      }
    }

    throw new Error(`Failed to read JSON file '${filePath}': ${error.message}`);
  }
}

async function writeJsonFile(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFilePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempFilePath, filePath);
}

function normalizeCompletedPhases(completedPhases) {
  return Array.isArray(completedPhases)
    ? completedPhases.filter((phase) => PHASES.includes(phase))
    : [];
}

function ensurePhaseCompleted(meta, phase) {
  meta.completedPhases = normalizeCompletedPhases(meta.completedPhases);
  if (!meta.completedPhases.includes(phase)) {
    meta.completedPhases.push(phase);
  }
}

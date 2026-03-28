import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getTargetWorkspacePath } from "../../../orchestrator/phase_manager.js";

const DEFAULT_CACHE_FILE = ".cache/tool-results.json";
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

export async function getCachedToolResult(target, toolName, toolTarget, toolOptions = {}, options = {}) {
  const cache = await loadToolCache(target, options);
  const key = buildCacheKey(toolName, toolTarget, toolOptions);
  const entry = cache.entries?.[key];

  if (!entry) {
    return null;
  }

  const ttlMs = options.cacheTtlMs || DEFAULT_TTL_MS;
  if ((Date.now() - new Date(entry.cachedAt).getTime()) > ttlMs) {
    return null;
  }

  return entry.result || null;
}

export async function setCachedToolResult(target, toolName, toolTarget, toolOptions = {}, result, options = {}) {
  const cache = await loadToolCache(target, options);
  const key = buildCacheKey(toolName, toolTarget, toolOptions);
  cache.entries = cache.entries || {};
  cache.entries[key] = {
    cachedAt: new Date().toISOString(),
    tool: toolName,
    target: toolTarget,
    options: toolOptions,
    result,
  };

  await saveToolCache(target, cache, options);
  return cache.entries[key];
}

export async function loadToolCache(target, options = {}) {
  const filePath = getCacheFilePath(target, options);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        target,
        entries: {},
      };
    }
    throw error;
  }
}

export async function saveToolCache(target, cache, options = {}) {
  const filePath = getCacheFilePath(target, options);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  return filePath;
}

export function getCacheFilePath(target, options = {}) {
  return path.join(getTargetWorkspacePath(target, options), DEFAULT_CACHE_FILE);
}

export function buildCacheKey(toolName, toolTarget, toolOptions = {}) {
  return JSON.stringify({
    toolName,
    toolTarget,
    toolOptions,
  });
}

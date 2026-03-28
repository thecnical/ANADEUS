import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeOptimizedTool, buildPerformanceMetrics, optimizeToolExecution } from "../src/core/performance/optimizer.js";
import { runWithConcurrency, prioritizeTarget } from "../src/core/performance/scheduler.js";
import { getCacheFilePath } from "../src/core/performance/cache_manager.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "anadeus-performance-"));
}

test("executeOptimizedTool caches successful tool results and reuses them", async () => {
  const workspaceRoot = await createTempWorkspace();
  let invocationCount = 0;

  const execute = async () => {
    invocationCount += 1;
    return {
      tool: "subfinder",
      target: "example.com",
      status: "success",
      data: { subdomains: ["api.example.com"] },
      raw_output: "",
      execution_time: 0.1,
    };
  };

  const first = await executeOptimizedTool({
    execute,
    toolName: "subfinder",
    phaseTarget: "example.com",
    toolTarget: "example.com",
    toolOptions: {},
    toolInput: { target: "example.com", task: { name: "subdomain_enumeration" } },
    options: { workspaceRoot },
  });

  const second = await executeOptimizedTool({
    execute,
    toolName: "subfinder",
    phaseTarget: "example.com",
    toolTarget: "example.com",
    toolOptions: {},
    toolInput: { target: "example.com", task: { name: "subdomain_enumeration" } },
    options: { workspaceRoot },
  });

  const cacheFile = getCacheFilePath("example.com", { workspaceRoot });
  const cacheContent = JSON.parse(await fs.readFile(cacheFile, "utf8"));

  assert.equal(first.cached, undefined);
  assert.equal(second.cached, true);
  assert.equal(invocationCount, 1);
  assert.ok(Object.keys(cacheContent.entries).length > 0);
});

test("runWithConcurrency prioritizes higher-value targets first", async () => {
  const observed = [];

  const results = await runWithConcurrency(
    ["https://example.com", "https://example.com/admin", "https://example.com/api/users"],
    async (item) => {
      observed.push(item);
      return item;
    },
    {
      concurrency: 1,
      prioritize: prioritizeTarget,
    },
  );

  assert.equal(observed[0], "https://example.com/admin");
  assert.deepEqual(results, observed);
});

test("optimizeToolExecution applies smart defaults and buildPerformanceMetrics summarizes cache hits", () => {
  const optimized = optimizeToolExecution("ffuf", {}, { task: { name: "directory_endpoint_discovery" } }, {});
  const metrics = buildPerformanceMetrics([
    {
      attempts: [
        { tool: "ffuf", result: { execution_time: 1.2, cached: false } },
        { tool: "subfinder", result: { execution_time: 0.4, cached: true } },
      ],
    },
  ]);

  assert.equal(optimized.toolOptions.timeout, 30);
  assert.equal(optimized.toolOptions.threads, 20);
  assert.equal(metrics.toolExecutions, 2);
  assert.equal(metrics.cacheHits, 1);
  assert.equal(metrics.totalExecutionTime, 1.6);
});

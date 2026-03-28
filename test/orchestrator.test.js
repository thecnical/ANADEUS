import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createToolRunnerExecutor, runPhase } from "../orchestrator/orchestrator.js";
import { loadMeta, loadPhaseData, updatePhaseState } from "../orchestrator/phase_manager.js";
import { sanitizeOptions } from "../orchestrator/task_engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "anadeus-orchestrator-"));
}

test("runPhase uses fallback tools and saves phase output", async () => {
  const workspaceRoot = await createTempWorkspace();
  const logFile = path.join(workspaceRoot, "logs", "orchestrator.log");

  const calls = [];
  const executeTool = async (toolName, target) => {
    calls.push(toolName);
    if (toolName === "subfinder") {
      return {
        tool: toolName,
        target,
        status: "error",
        data: {},
        raw_output: "",
        execution_time: 0.1,
        error_type: "tool_not_found",
        message: "subfinder missing",
      };
    }

    return {
      tool: toolName,
      target,
      status: "success",
      data: { open_ports: [80, 443] },
      raw_output: "mock output",
      execution_time: 0.2,
    };
  };

  const result = await runPhase("example.com", "recon", [
    {
      name: "surface_discovery",
      tools: ["subfinder", "nmap"],
    },
  ], {
    workspaceRoot,
    logFile,
    executeTool,
  });

  assert.equal(result.status, "success");
  assert.equal(result.tasks[0].selectedTool, "nmap");
  assert.deepEqual(calls, ["subfinder", "nmap"]);

  const saved = await loadPhaseData("example.com", "recon", { workspaceRoot });
  assert.equal(saved.tasks[0].selectedTool, "nmap");
});

test("runPhase skips previously successful tasks unless force is enabled", async () => {
  const workspaceRoot = await createTempWorkspace();
  let invocationCount = 0;

  const executeTool = async () => {
    invocationCount += 1;
    return {
      tool: "nmap",
      target: "example.com",
      status: "success",
      data: { open_ports: [80] },
      raw_output: "mock output",
      execution_time: 0.1,
    };
  };

  await runPhase("example.com", "recon", [
    { name: "port_scan", tools: ["nmap"] },
  ], {
    workspaceRoot,
    executeTool,
  });

  const secondRun = await runPhase("example.com", "recon", [
    { name: "port_scan", tools: ["nmap"] },
  ], {
    workspaceRoot,
    executeTool,
  });

  assert.equal(invocationCount, 1);
  assert.equal(secondRun.tasks[0].status, "skipped");
});

test("createToolRunnerExecutor integrates with python tool runner contract", async () => {
  const fixtureRunner = path.join(__dirname, "fixtures", "mock_tool_runner.py");
  const executor = createToolRunnerExecutor({
    pythonBinary: "python",
    toolRunnerPath: fixtureRunner,
    integrationTimeoutMs: 30000,
  });

  const subfinderResult = await executor("subfinder", "example.com", {});
  const nmapResult = await executor("nmap", "example.com", {});

  assert.equal(subfinderResult.status, "error");
  assert.equal(subfinderResult.error_type, "tool_not_found");
  assert.equal(nmapResult.status, "success");
  assert.deepEqual(nmapResult.data.open_ports, [80, 443]);
});

test("sanitizeOptions strips unsupported fallback options", () => {
  const sanitized = sanitizeOptions("webprobe", {
    follow_redirects: true,
    status_code: true,
    tech_detect: true,
    threads: 25,
    title: true,
    timeout: 8,
  });

  assert.deepEqual(sanitized, { timeout: 8 });
});

test("updatePhaseState overwrites stale phase errors on success", async () => {
  const workspaceRoot = await createTempWorkspace();

  await updatePhaseState("example.com", "analysis", {
    status: "error",
    error: "old failure",
    message: "stale message",
  }, { workspaceRoot });

  await updatePhaseState("example.com", "analysis", {
    status: "success",
    summary: { totalTasks: 1 },
  }, { workspaceRoot });

  const meta = await loadMeta("example.com", { workspaceRoot });
  assert.equal(meta.phases.analysis.status, "success");
  assert.equal("error" in meta.phases.analysis, false);
  assert.equal("message" in meta.phases.analysis, false);
  assert.deepEqual(meta.completedPhases, ["analysis"]);
});

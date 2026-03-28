import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureWorkspaceStructure } from "../orchestrator/phase_manager.js";
import { runAllTests, runTest } from "../src/core/testing/test_runner.js";
import { validatePhaseOutput } from "../src/core/testing/validator.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "anadeus-testing-system-"));
}

function createMockToolExecutor() {
  return async (toolName, target) => {
    if (toolName === "subfinder" || toolName === "amass" || toolName === "assetfinder") {
      return {
        tool: toolName,
        target,
        status: "success",
        data: {
          subdomains: ["api.example.com", "dev.example.com"],
        },
        raw_output: "",
        execution_time: 0.1,
      };
    }

    if (toolName === "httpx") {
      return {
        tool: toolName,
        target,
        status: "success",
        data: {
          alive_hosts: [
            {
              url: `https://${String(target).replace(/^https?:\/\//, "")}`,
              host: String(target).replace(/^https?:\/\//, ""),
              status_code: 200,
              technologies: ["nginx"],
            },
          ],
          technologies: ["nginx"],
        },
        raw_output: "",
        execution_time: 0.1,
      };
    }

    if (toolName === "whatweb") {
      return {
        tool: toolName,
        target,
        status: "success",
        data: {
          findings: [
            {
              url: target,
              plugins: [{ name: "Laravel" }],
            },
          ],
          technologies: ["Laravel"],
        },
        raw_output: "",
        execution_time: 0.1,
      };
    }

    if (toolName === "nmap") {
      return {
        tool: toolName,
        target,
        status: "success",
        data: {
          open_ports: [80, 443],
          services: ["http", "https"],
          port_details: [
            { port: 80, protocol: "tcp", service: "http", product: "nginx", version: "1.25" },
          ],
        },
        raw_output: "",
        execution_time: 0.1,
      };
    }

    if (toolName === "ffuf" || toolName === "dirsearch" || toolName === "feroxbuster") {
      return {
        tool: toolName,
        target,
        status: "success",
        data: {
          matches: [
            { url: `${String(target).replace(/\/$/, "")}/admin`, path: "/admin", status: 200 },
            { url: `${String(target).replace(/\/$/, "")}/api/user?id=1`, path: "/api/user?id=1", status: 200 },
          ],
          directories: ["/admin"],
          paths: ["/api/user?id=1"],
          count: 2,
        },
        raw_output: "",
        execution_time: 0.1,
      };
    }

    if (toolName === "nikto") {
      return {
        tool: toolName,
        target,
        status: "success",
        data: {
          findings: [],
          notes: ["Outdated server banner detected"],
          count: 0,
        },
        raw_output: "",
        execution_time: 0.1,
      };
    }

    return {
      tool: toolName,
      target,
      status: "error",
      data: {},
      raw_output: "",
      execution_time: 0.1,
      error_type: "unsupported_tool",
      message: `${toolName} not mocked`,
    };
  };
}

function createMockRequestExecutor() {
  return async (url) => {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("id");

    if (parsed.pathname.includes("/api/user")) {
      return {
        status: 200,
        url,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(id === "2" ? { id: 2, owner: "other-user" } : { id: 1, owner: "self" }),
        contentType: "application/json",
      };
    }

    if (parsed.pathname.includes("/admin")) {
      return {
        status: 200,
        url,
        headers: { "content-type": "text/html" },
        body: "<html><body><h1>Admin Dashboard</h1></body></html>",
        contentType: "text/html",
      };
    }

    return {
      status: 200,
      url,
      headers: { "content-type": "text/html" },
      body: "<html><body>ok</body></html>",
      contentType: "text/html",
    };
  };
}

test("validatePhaseOutput reports invalid JSON cleanly", async () => {
  const workspaceRoot = await createTempWorkspace();
  await ensureWorkspaceStructure("example.com", { workspaceRoot });
  const analysisPath = path.join(workspaceRoot, "example.com", "analysis", "vuln_candidates.json");
  await fs.writeFile(analysisPath, "{invalid json", "utf8");

  const result = await validatePhaseOutput("analysis", "example.com", { workspaceRoot });

  assert.equal(result.status, "error");
  assert.match(result.issue, /invalid JSON/i);
});

test("runTest executes and validates a single phase", async () => {
  const workspaceRoot = await createTempWorkspace();
  const result = await runTest("recon", "example.com", {
    workspaceRoot,
    executeTool: createMockToolExecutor(),
  });

  assert.equal(result.phase, "recon");
  assert.equal(result.status, "pass");
});

test("runAllTests validates the full pipeline and returns a summary report", async () => {
  const workspaceRoot = await createTempWorkspace();
  const testingLogFile = path.join(workspaceRoot, "logs", "testing.log");

  const result = await runAllTests("example.com", {
    workspaceRoot,
    testingLogFile,
    executeTool: createMockToolExecutor(),
    requestExecutor: createMockRequestExecutor(),
  });

  const logContent = await fs.readFile(testingLogFile, "utf8");

  assert.equal(result.target, "example.com");
  assert.equal(result.type, "test");
  assert.equal(result.results.length, 5);
  assert.equal(result.summary.recon, "pass");
  assert.equal(result.summary.scan, "pass");
  assert.equal(result.summary.analysis, "pass");
  assert.ok(["pass", "warning"].includes(result.summary.exploit));
  assert.ok(["pass", "warning"].includes(result.summary.report));
  assert.match(logContent, /test_started/);
  assert.match(logContent, /test_completed/);
});

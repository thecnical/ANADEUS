import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runScanner } from "../agents/scanner/scanner_agent.js";
import { ensureWorkspaceStructure, savePhaseData } from "../orchestrator/phase_manager.js";
import { parseUserInput } from "../src/core/command-parser.js";
import { handleAgentCommand } from "../src/services/agent-command-service.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "anadeus-scanner-agent-"));
}

function createMockScanExecutor() {
  return async (toolName, target) => {
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
            { port: 443, protocol: "tcp", service: "https", product: "nginx", version: "1.25" },
          ],
        },
        raw_output: "",
        execution_time: 0.1,
      };
    }

    if (toolName === "ffuf") {
      return {
        tool: toolName,
        target,
        status: "error",
        data: {},
        raw_output: "",
        execution_time: 0.1,
        error_type: "command_failure",
        message: "ffuf failed",
      };
    }

    if (toolName === "dirsearch") {
      return {
        tool: toolName,
        target,
        status: "success",
        data: {
          matches: [
            { url: `${String(target).replace(/\/$/, "")}/admin`, path: "/admin", status: 200 },
            { url: `${String(target).replace(/\/$/, "")}/api/v1`, path: "/api/v1", status: 200 },
          ],
          directories: ["/admin", "/api/v1"],
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
          findings: [
            {
              id: "OSVDB-0001",
              url: target,
              path: "/",
              message: "Outdated server banner detected",
              severity: "medium",
            },
          ],
          notes: ["Nikto flagged an outdated server banner"],
          count: 1,
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

async function seedRecon(workspaceRoot) {
  await ensureWorkspaceStructure("example.com", { workspaceRoot });
  await savePhaseData("example.com", "recon", {
    target: "example.com",
    phase: "recon",
    status: "success",
    subdomains: ["api.example.com", "dev.example.com"],
    alive_hosts: ["https://api.example.com", "https://dev.example.com"],
    technologies: ["nginx"],
    endpoints: ["/login"],
    summary: {
      totalTasks: 4,
      successfulTasks: 4,
      failedTasks: 0,
      skippedTasks: 0,
      progress: 100,
    },
    tasks: [],
  }, { workspaceRoot });
}

test("runScanner aggregates ports, directories, endpoints, and notes", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedRecon(workspaceRoot);

  const result = await runScanner("example.com", "deep", {
    workspaceRoot,
    executeTool: createMockScanExecutor(),
  });

  assert.equal(result.phase, "scan");
  assert.equal(result.status, "success");
  assert.ok(result.hosts_scanned.includes("https://api.example.com"));
  assert.deepEqual(result.open_ports, [80, 443]);
  assert.ok(result.services.includes("http"));
  assert.ok(result.directories.some((directory) => directory.includes("/admin")));
  assert.ok(result.endpoints.some((endpoint) => endpoint.includes("/admin")));
  assert.ok(result.notes.includes("Admin surface detected"));
  assert.ok(result.notes.includes("API endpoint found"));
  assert.ok(result.notes.includes("Nikto flagged an outdated server banner"));
  assert.ok(result.nikto_findings.length > 0);
});

test("runScanner returns error if recon data is missing", async () => {
  const workspaceRoot = await createTempWorkspace();

  const result = await runScanner("example.com", "deep", { workspaceRoot });

  assert.equal(result.status, "error");
  assert.equal(result.error_type, "missing_recon_data");
});

test("handleAgentCommand routes @scanner to runScanner", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedRecon(workspaceRoot);

  const originalEnv = process.env.ANADEUS_WORKSPACE_ROOT;
  process.env.ANADEUS_WORKSPACE_ROOT = workspaceRoot;

  try {
    const parsed = parseUserInput("@scanner example.com light");
    const result = await handleAgentCommand({ mode: "chat", parsed });

    assert.equal(result.type, "agent");
    assert.equal(result.phase, "scan");
    assert.equal(result.target, "example.com");
  } finally {
    if (originalEnv === undefined) {
      delete process.env.ANADEUS_WORKSPACE_ROOT;
    } else {
      process.env.ANADEUS_WORKSPACE_ROOT = originalEnv;
    }
  }
});

test("handleAgentCommand routes @scan alias to runScanner", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedRecon(workspaceRoot);

  const originalEnv = process.env.ANADEUS_WORKSPACE_ROOT;
  process.env.ANADEUS_WORKSPACE_ROOT = workspaceRoot;

  try {
    const parsed = parseUserInput("@scan example.com light");
    const result = await handleAgentCommand({ mode: "chat", parsed });

    assert.equal(result.type, "agent");
    assert.equal(result.phase, "scan");
    assert.equal(result.target, "example.com");
  } finally {
    if (originalEnv === undefined) {
      delete process.env.ANADEUS_WORKSPACE_ROOT;
    } else {
      process.env.ANADEUS_WORKSPACE_ROOT = originalEnv;
    }
  }
});

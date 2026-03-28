import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runAnalysis } from "../agents/analysis/analysis_agent.js";
import { ensureWorkspaceStructure, savePhaseData } from "../orchestrator/phase_manager.js";
import { parseUserInput } from "../src/core/command-parser.js";
import { executePhasePlan } from "../src/services/orchestration-service.js";
import { handleAgentCommand } from "../src/services/agent-command-service.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "anadeus-analysis-agent-"));
}

async function seedReconAndScan(workspaceRoot) {
  await ensureWorkspaceStructure("example.com", { workspaceRoot });

  await savePhaseData("example.com", "recon", {
    target: "example.com",
    phase: "recon",
    status: "success",
    technologies: ["PHP", "Laravel"],
    endpoints: ["/login?redirect=/dashboard"],
    alive_hosts: ["https://api.example.com"],
  }, { workspaceRoot });

  await savePhaseData("example.com", "scan", {
    target: "example.com",
    phase: "scan",
    status: "success",
    directories: ["/admin", "/api/v1/users"],
    endpoints: [
      "https://api.example.com/api/user?id=1",
      "https://api.example.com/search?q=test",
    ],
    technologies: ["nginx"],
    services: ["http", "https"],
    open_ports: [80, 443],
    notes: ["Outdated server banner detected"],
  }, { workspaceRoot });
}

test("runAnalysis generates prioritized vulnerability candidates and writes vuln_candidates.json", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedReconAndScan(workspaceRoot);

  const result = await runAnalysis("example.com", { workspaceRoot });
  const vulnFile = path.join(workspaceRoot, "example.com", "analysis", "vuln_candidates.json");
  const saved = JSON.parse(await fs.readFile(vulnFile, "utf8"));

  assert.equal(result.phase, "analysis");
  assert.equal(result.status, "success");
  assert.ok(result.vulnerabilities.length > 0);
  assert.ok(result.vulnerabilities.some((item) => item.type === "Auth Bypass" && item.endpoint.includes("/login")));
  assert.ok(result.vulnerabilities.some((item) => item.type === "IDOR" && item.parameter === "id"));
  assert.ok(result.vulnerabilities.some((item) => item.type === "XSS" && item.parameter === "q"));
  assert.ok(result.vulnerabilities.some((item) => item.type === "Security Misconfiguration"));
  assert.equal(saved.phase, "analysis");
  assert.deepEqual(saved.vulnerabilities, result.vulnerabilities);
});

test("runAnalysis merges AI-assisted candidates into the final output", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedReconAndScan(workspaceRoot);

  const result = await runAnalysis("example.com", {
    workspaceRoot,
    aiReasoner: async ({ prompt, context }) => {
      assert.ok(prompt.includes("SQL Injection"));
      assert.equal(context.target, "example.com");

      return [
        {
          type: "CSRF",
          endpoint: "/profile/update",
          confidence: "medium",
          severity: "medium",
          reason: "AI detected a likely state-changing authenticated workflow.",
          tags: ["ai", "auth"],
        },
      ];
    },
  });

  assert.ok(result.vulnerabilities.some((item) => item.source === "ai" && item.endpoint === "/profile/update"));
  assert.ok(result.summary.ai_generated >= 1);
});

test("runAnalysis returns a structured error when scan data is missing", async () => {
  const workspaceRoot = await createTempWorkspace();
  await ensureWorkspaceStructure("example.com", { workspaceRoot });

  const result = await runAnalysis("example.com", { workspaceRoot });

  assert.equal(result.status, "error");
  assert.equal(result.error_type, "missing_scan_data");
});

test("handleAgentCommand routes @analysis to runAnalysis", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedReconAndScan(workspaceRoot);

  const originalEnv = process.env.ANADEUS_WORKSPACE_ROOT;
  process.env.ANADEUS_WORKSPACE_ROOT = workspaceRoot;

  try {
    const parsed = parseUserInput("@analysis example.com");
    const result = await handleAgentCommand({ mode: "chat", parsed });

    assert.equal(result.type, "agent");
    assert.equal(result.phase, "analysis");
    assert.equal(result.target, "example.com");
    assert.equal(result.ok, true);
  } finally {
    if (originalEnv === undefined) {
      delete process.env.ANADEUS_WORKSPACE_ROOT;
    } else {
      process.env.ANADEUS_WORKSPACE_ROOT = originalEnv;
    }
  }
});

test("executePhasePlan runs the analysis agent when no task template is provided", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedReconAndScan(workspaceRoot);

  const originalEnv = process.env.ANADEUS_WORKSPACE_ROOT;
  process.env.ANADEUS_WORKSPACE_ROOT = workspaceRoot;

  try {
    const result = await executePhasePlan({
      target: "example.com",
      phase: "analysis",
    });

    assert.equal(result.ok, true);
    assert.equal(result.phase, "analysis");
    assert.equal(result.result.phase, "analysis");
    assert.ok(Array.isArray(result.result.vulnerabilities));
  } finally {
    if (originalEnv === undefined) {
      delete process.env.ANADEUS_WORKSPACE_ROOT;
    } else {
      process.env.ANADEUS_WORKSPACE_ROOT = originalEnv;
    }
  }
});

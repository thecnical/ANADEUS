import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runReport } from "../agents/report/report_agent.js";
import { ensureWorkspaceStructure, savePhaseData } from "../orchestrator/phase_manager.js";
import { parseUserInput } from "../src/core/command-parser.js";
import { executePhasePlan } from "../src/services/orchestration-service.js";
import { handleAgentCommand } from "../src/services/agent-command-service.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "anadeus-report-agent-"));
}

async function seedReportInputs(workspaceRoot, { withPoc = true } = {}) {
  await ensureWorkspaceStructure("example.com", { workspaceRoot });

  const exploitData = {
    target: "example.com",
    phase: "exploit",
    status: "success",
    confirmed_vulnerabilities: [
      {
        type: "IDOR",
        endpoint: "https://api.example.com/api/user?id=1",
        parameter: "id",
        status: "confirmed",
        confidence: "high",
        severity: "high",
        reason: "Direct object reference pattern detected in API route.",
        evidence: [
          "Adjacent object identifier '2' returned a changed successful response without an obvious denial message.",
        ],
        poc_steps: [
          "Open https://api.example.com/api/user?id=1 in an authorized testing session.",
          "Apply the safe validation value '2' to the parameter 'id'.",
          "Observe a changed successful response tied to another object identifier.",
        ],
      },
      {
        type: "Auth Bypass",
        endpoint: "/admin",
        parameter: null,
        status: "confirmed",
        confidence: "high",
        severity: "high",
        reason: "Protected administrative content was reachable without an authenticated session.",
        evidence: [
          "Protected-looking content was accessible with an unauthenticated safe GET request.",
        ],
        poc_steps: [
          "Open the /admin endpoint in an unauthenticated session.",
          "Observe administrative interface content without a login challenge.",
        ],
      },
    ],
    poc: {
      location: path.join(workspaceRoot, "example.com", "poc", "poc.md"),
      generated: withPoc,
    },
  };

  await savePhaseData("example.com", "exploit", exploitData, { workspaceRoot });

  if (withPoc) {
    await fs.writeFile(
      exploitData.poc.location,
      [
        "# ANADEUS Proof of Concept",
        "",
        "## 1. IDOR - https://api.example.com/api/user?id=1",
        "1. Open the endpoint in an authorized session.",
        "2. Change id to 2.",
        "3. Observe another object's response.",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

test("runReport generates impact.json and final_report.md from confirmed vulnerabilities", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedReportInputs(workspaceRoot);

  const result = await runReport("example.com", { workspaceRoot });
  const impactPath = path.join(workspaceRoot, "example.com", "report", "impact.json");
  const reportPath = path.join(workspaceRoot, "example.com", "report", "final_report.md");
  const impact = JSON.parse(await fs.readFile(impactPath, "utf8"));
  const finalReport = await fs.readFile(reportPath, "utf8");

  assert.equal(result.phase, "report");
  assert.equal(result.status, "success");
  assert.equal(result.summary.total, 2);
  assert.ok(result.reports.some((item) => item.type === "IDOR"));
  assert.ok(result.reports.some((item) => item.severity === "Critical"));
  assert.equal(impact.summary.total, 2);
  assert.ok(finalReport.includes("# ANADEUS Security Report"));
  assert.ok(finalReport.includes("Executive Summary"));
  assert.ok(finalReport.includes("Recommended Fix"));
  assert.ok(finalReport.includes("IDOR"));
});

test("runReport still generates a report when poc.md is missing", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedReportInputs(workspaceRoot, { withPoc: false });

  const result = await runReport("example.com", { workspaceRoot });

  assert.equal(result.status, "success");
  assert.ok(result.warnings.some((warning) => warning.includes("PoC markdown was not found")));
});

test("runReport returns a structured error when exploit data is missing", async () => {
  const workspaceRoot = await createTempWorkspace();
  await ensureWorkspaceStructure("example.com", { workspaceRoot });

  const result = await runReport("example.com", { workspaceRoot });

  assert.equal(result.status, "error");
  assert.equal(result.error_type, "missing_exploit_data");
});

test("handleAgentCommand routes @report to runReport", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedReportInputs(workspaceRoot);

  const originalEnv = process.env.ANADEUS_WORKSPACE_ROOT;
  process.env.ANADEUS_WORKSPACE_ROOT = workspaceRoot;

  try {
    const parsed = parseUserInput("@report example.com");
    const result = await handleAgentCommand({ mode: "chat", parsed });

    assert.equal(result.type, "agent");
    assert.equal(result.phase, "report");
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

test("executePhasePlan runs the report agent when no task template is provided", async () => {
  const workspaceRoot = await createTempWorkspace();
  await seedReportInputs(workspaceRoot);

  const originalEnv = process.env.ANADEUS_WORKSPACE_ROOT;
  process.env.ANADEUS_WORKSPACE_ROOT = workspaceRoot;

  try {
    const result = await executePhasePlan({
      target: "example.com",
      phase: "report",
    });

    assert.equal(result.ok, true);
    assert.equal(result.phase, "report");
    assert.equal(result.result.phase, "report");
    assert.ok(Array.isArray(result.result.reports));
  } finally {
    if (originalEnv === undefined) {
      delete process.env.ANADEUS_WORKSPACE_ROOT;
    } else {
      process.env.ANADEUS_WORKSPACE_ROOT = originalEnv;
    }
  }
});

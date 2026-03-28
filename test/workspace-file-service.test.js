import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readWorkspaceArtifact } from "../src/services/workspace-file-service.js";
import { ensureWorkspaceStructure, savePhaseData, saveMeta } from "../orchestrator/phase_manager.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "anadeus-workspace-file-"));
}

test("readWorkspaceArtifact loads saved phase data", async () => {
  const workspaceRoot = await createTempWorkspace();
  await ensureWorkspaceStructure("example.com", { workspaceRoot });
  await savePhaseData("example.com", "recon", {
    target: "example.com",
    phase: "recon",
    status: "success",
    summary: { progress: 100 },
  }, { workspaceRoot });

  const result = await readWorkspaceArtifact("show", "recon example.com", { workspaceRoot });

  assert.equal(result.ok, true);
  assert.equal(result.data.phase, "recon");
});

test("readWorkspaceArtifact loads workspace meta status", async () => {
  const workspaceRoot = await createTempWorkspace();
  await ensureWorkspaceStructure("example.com", { workspaceRoot });
  await saveMeta("example.com", {
    target: "example.com",
    workspace: path.join(workspaceRoot, "example.com"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activePhase: "recon",
    completedPhases: ["recon"],
    phases: {
      recon: {
        status: "success",
      },
    },
  }, { workspaceRoot });

  const result = await readWorkspaceArtifact("status", "example.com", { workspaceRoot });

  assert.equal(result.ok, true);
  assert.equal(result.data.activePhase, "recon");
});

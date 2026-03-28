import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startDashboardServer } from "../dashboard/backend/server.js";

async function createTempWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "anadeus-dashboard-"));
  const targetRoot = path.join(root, "workspace", "example.com");
  await mkdir(path.join(targetRoot, "recon"), { recursive: true });
  await writeFile(path.join(targetRoot, "meta.json"), JSON.stringify({
    target: "example.com",
    workspace: targetRoot,
    activePhase: "scan",
    phases: {
      recon: { status: "success" },
      scan: { status: "running" },
    },
  }, null, 2));
  await writeFile(path.join(targetRoot, "recon", "recon.json"), JSON.stringify({
    target: "example.com",
    status: "success",
    subdomains: ["api.example.com"],
    alive_hosts: ["https://api.example.com"],
    technologies: ["nginx"],
    endpoints: ["https://api.example.com/login"],
  }, null, 2));
  return {
    logsDirectory: path.join(root, "logs"),
    workspaceRoot: path.join(root, "workspace"),
  };
}

test("dashboard server exposes target and system API routes", async () => {
  const fixture = await createTempWorkspace();
  const server = await startDashboardServer({
    host: "127.0.0.1",
    logsDirectory: fixture.logsDirectory,
    port: 4211,
    quiet: true,
    workspaceRoot: fixture.workspaceRoot,
  });

  try {
    const [targetsResponse, systemResponse] = await Promise.all([
      fetch(`${server.address}/api/targets`).then((response) => response.json()),
      fetch(`${server.address}/api/system/status`).then((response) => response.json()),
    ]);

    assert.equal(targetsResponse.ok, true);
    assert.deepEqual(targetsResponse.targets, ["example.com"]);
    assert.equal(systemResponse.ok, true);
    assert.equal(systemResponse.system.targets[0].target, "example.com");
  } finally {
    await server.close();
  }
});

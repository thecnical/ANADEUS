import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runRecon } from "../agents/recon/recon_agent.js";
import { parseUserInput } from "../src/core/command-parser.js";
import { handleAgentCommand } from "../src/services/agent-command-service.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "anadeus-recon-agent-"));
}

function createMockReconExecutor() {
  return async (toolName, target) => {
    if (toolName === "subfinder") {
      return {
        tool: toolName,
        target,
        status: "success",
        data: {
          subdomains: ["api.example.com", "dev.example.com", "api.example.com"],
        },
        raw_output: "subfinder-output",
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
              url: `https://${target}`,
              host: target,
              status_code: 200,
              title: `${target} home`,
              technologies: ["nginx", "react"],
              ip: "1.1.1.1",
            },
          ],
          technologies: ["nginx", "react"],
        },
        raw_output: "httpx-output",
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
              status: "200 OK",
              plugins: [{ name: "WordPress", value: "6.0" }],
            },
          ],
          identified_technologies: ["WordPress"],
        },
        raw_output: "whatweb-output",
        execution_time: 0.1,
      };
    }

    if (toolName === "ffuf") {
      return {
        tool: toolName,
        target,
        status: "success",
        data: {
          matches: [
            { url: `${target.replace(/\/$/, "")}/login`, path: "/login", status: 200 },
            { url: `${target.replace(/\/$/, "")}/api/v1`, path: "/api/v1", status: 200 },
          ],
          paths: ["/login", "/api/v1"],
          status_codes: [200],
          count: 2,
        },
        raw_output: "ffuf-output",
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

test("runRecon aggregates subdomains, alive hosts, technologies, and endpoints", async () => {
  const workspaceRoot = await createTempWorkspace();
  const result = await runRecon("example.com", "deep", {
    workspaceRoot,
    executeTool: createMockReconExecutor(),
  });

  assert.equal(result.phase, "recon");
  assert.equal(result.status, "success");
  assert.deepEqual(result.subdomains, ["api.example.com", "dev.example.com"]);
  assert.ok(result.alive_hosts.includes("https://api.example.com"));
  assert.ok(result.technologies.includes("nginx"));
  assert.ok(result.technologies.includes("WordPress"));
  assert.ok(result.endpoints.some((endpoint) => endpoint.includes("/login")));
});

test("handleAgentCommand routes @recon to runRecon", async () => {
  const workspaceRoot = await createTempWorkspace();
  const parsed = parseUserInput("@recon example.com light");
  const originalEnv = process.env.ANADEUS_WORKSPACE_ROOT;

  process.env.ANADEUS_WORKSPACE_ROOT = workspaceRoot;

  try {
    const result = await handleAgentCommand({ mode: "chat", parsed });
    assert.equal(result.type, "agent");
    assert.equal(result.phase, "recon");
    assert.equal(result.target, "example.com");
  } finally {
    if (originalEnv === undefined) {
      delete process.env.ANADEUS_WORKSPACE_ROOT;
    } else {
      process.env.ANADEUS_WORKSPACE_ROOT = originalEnv;
    }
  }
});

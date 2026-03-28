import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeAutoMode, parseAutoPayload } from "../src/services/auto-mode-service.js";
import { loadMeta } from "../orchestrator/phase_manager.js";

async function createTempWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), "anadeus-auto-mode-"));
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

function createMockModelRouter() {
  return {
    hasAvailableProviders() {
      return true;
    },
    async generateObject({ prompt }) {
      if (prompt.includes("Return keys: phase, tasks")) {
        if (prompt.includes("Phase: recon")) {
          return {
            provider: "mock-ai",
            object: {
              phase: "recon",
              rationale: "Prioritize subdomains first.",
              tasks: [
                { name: "subdomain_enumeration", tools: ["subfinder", "amass"], retries: 1, continueOnFailure: true },
                { name: "alive_host_detection", tools: ["httpx"], retries: 1, continueOnFailure: true },
                { name: "technology_detection", tools: ["whatweb"], continueOnFailure: true },
                { name: "endpoint_discovery", tools: ["ffuf"], continueOnFailure: true },
              ],
            },
          };
        }

        return {
          provider: "mock-ai",
          object: {
            phase: "scan",
            rationale: "Validate ports then content discovery.",
            tasks: [
              { name: "port_service_scan", tools: [{ name: "nmap", options: { top_ports: 1000, service_version: true } }], continueOnFailure: true },
              { name: "directory_endpoint_discovery", tools: ["ffuf", "dirsearch"], continueOnFailure: true },
              { name: "web_server_scan", tools: ["nikto"], continueOnFailure: true },
            ],
          },
        };
      }

      if (prompt.includes("Return JSON only with key: vulnerabilities")) {
        return {
          provider: "mock-ai",
          object: {
            vulnerabilities: [
              {
                type: "IDOR",
                endpoint: "https://api.example.com/api/user?id=1",
                parameter: "id",
                confidence: "high",
                severity: "high",
                reason: "API endpoint exposes a direct object identifier.",
                tags: ["api", "authorization"],
              },
            ],
          },
        };
      }

      if (prompt.includes("executive_summary")) {
        return {
          provider: "mock-ai",
          object: {
            executive_summary: "The confirmed findings show a meaningful access-control risk in authenticated application flows.",
            remediation_priorities: ["Fix broken object-level authorization first."],
            analyst_notes: ["The report was AI-assisted and should still be reviewed by an operator."],
          },
        };
      }

      return {
        provider: "mock-ai",
        object: {
          should_continue: true,
          next_phase: prompt.includes("\"completedPhases\":[\"recon\",\"scan\",\"analysis\",\"exploit\"]")
            ? "report"
            : prompt.includes("\"completedPhases\":[\"recon\",\"scan\",\"analysis\"]")
              ? "exploit"
              : prompt.includes("\"completedPhases\":[\"recon\",\"scan\"]")
                ? "analysis"
                : prompt.includes("\"completedPhases\":[\"recon\"]")
                  ? "scan"
                  : "recon",
          rationale: "Proceed to the next pipeline phase.",
        },
      };
    },
    async generateText() {
      return {
        provider: "mock-ai",
        text: "Auto goal interpreted successfully.",
      };
    },
  };
}

test("executeAutoMode runs the full intelligent pipeline with AI planning", async () => {
  const workspaceRoot = await createTempWorkspace();
  const logFile = path.join(workspaceRoot, "logs", "system.log");

  const result = await executeAutoMode({
    target: "example.com",
    mode: "deep",
    options: {
      workspaceRoot,
      logFile,
      modelRouter: createMockModelRouter(),
      executeTool: createMockToolExecutor(),
      requestExecutor: createMockRequestExecutor(),
    },
  });

  const meta = await loadMeta("example.com", { workspaceRoot });
  const systemLog = await fs.readFile(logFile, "utf8");

  assert.equal(result.ok, true);
  assert.equal(result.status, "success");
  assert.ok(result.completedPhases.includes("recon"));
  assert.ok(result.completedPhases.includes("scan"));
  assert.ok(result.completedPhases.includes("analysis"));
  assert.ok(result.completedPhases.includes("exploit"));
  assert.ok(result.completedPhases.includes("report"));
  assert.ok(result.phases.some((phase) => phase.phase === "report"));
  assert.ok(meta.aiMemory.length > 0);
  assert.match(systemLog, /phase_started/);
  assert.match(systemLog, /tool_executed/);
});

test("parseAutoPayload extracts target and depth flags", () => {
  assert.deepEqual(parseAutoPayload("example.com --deep"), {
    target: "example.com",
    mode: "deep",
  });

  assert.deepEqual(parseAutoPayload("example.com --light"), {
    target: "example.com",
    mode: "light",
  });
});

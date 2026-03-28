import test from "node:test";
import assert from "node:assert/strict";
import { buildScannerTasks } from "../agents/scanner/scanner_utils.js";
import {
  determineHeuristicNextPhase,
  generatePhaseTasks,
} from "../src/core/ai/decision_engine.js";
import {
  calculateDataQualityScore,
  optimizeTasksForPhase,
  prioritizeCandidates,
  reduceFalsePositives,
  scoreCandidateConfidence,
} from "../src/core/ai/scoring.js";

function buildContext(overrides = {}) {
  return {
    target: "example.com",
    meta: {
      completedPhases: [],
      activePhase: null,
      ...(overrides.meta || {}),
    },
    recon: overrides.recon || null,
    scan: overrides.scan || null,
    analysis: overrides.analysis || null,
    exploit: overrides.exploit || null,
    report: overrides.report || null,
  };
}

test("optimizeTasksForPhase skips web scan tasks when no web surface exists", () => {
  const tasks = buildScannerTasks("deep");
  const context = buildContext({
    recon: {
      alive_hosts: [],
      endpoints: [],
      technologies: [],
    },
    scan: {
      services: [],
      open_ports: [],
    },
  });

  const optimized = optimizeTasksForPhase("scan", tasks, context, "deep");

  assert.deepEqual(optimized.tasks.map((task) => task.name), ["port_service_scan"]);
  assert.ok(optimized.reasoning.some((item) => item.includes("Skipped web discovery tasks")));
});

test("scoreCandidateConfidence rewards strong auth and API signals", () => {
  const context = buildContext({
    recon: {
      alive_hosts: ["https://api.example.com"],
      endpoints: ["/login", "/api/user"],
      technologies: ["Laravel", "PHP"],
      subdomains: ["api.example.com"],
    },
    scan: {
      endpoints: ["https://api.example.com/api/user?id=1"],
      services: ["http"],
      open_ports: [443],
      directories: ["/admin"],
    },
  });

  const strong = {
    type: "IDOR",
    endpoint: "https://api.example.com/api/user?id=1",
    parameter: "id",
    reason: "Direct object reference in API route.",
    tags: ["api", "authorization"],
  };
  const weak = {
    type: "XSS",
    endpoint: "/misc",
    parameter: null,
    reason: "",
    tags: [],
  };

  assert.ok(scoreCandidateConfidence(strong, context) > scoreCandidateConfidence(weak, context));
  assert.ok(calculateDataQualityScore(context) > 0.5);
});

test("reduceFalsePositives removes weak unsupported candidates and prioritizes stronger ones", () => {
  const context = buildContext({
    recon: {
      alive_hosts: ["https://app.example.com"],
      endpoints: ["/login", "/api/user"],
      technologies: ["Laravel"],
      subdomains: ["app.example.com"],
    },
    scan: {
      endpoints: ["https://app.example.com/api/user?id=1"],
      services: ["http"],
      open_ports: [443],
      directories: ["/admin"],
    },
  });

  const candidates = [
    {
      type: "IDOR",
      endpoint: "https://app.example.com/api/user?id=1",
      parameter: "id",
      reason: "API object reference found.",
      tags: ["api", "authorization"],
    },
    {
      type: "XSS",
      endpoint: "/misc",
      parameter: null,
      reason: "",
      tags: [],
    },
  ];

  const filtered = reduceFalsePositives(candidates, context);
  const prioritized = prioritizeCandidates(filtered, context);

  assert.equal(filtered.length, 1);
  assert.equal(prioritized[0].type, "IDOR");
  assert.ok(typeof prioritized[0].confidence_score === "number");
});

test("determineHeuristicNextPhase stops after analysis when no vulnerabilities exist", () => {
  const context = buildContext({
    meta: {
      completedPhases: ["recon", "scan", "analysis"],
    },
    analysis: {
      vulnerabilities: [],
    },
  });

  const decision = determineHeuristicNextPhase(context);

  assert.equal(decision.should_continue, false);
  assert.equal(decision.next_phase, null);
  assert.match(decision.rationale, /no meaningful vulnerability candidates/i);
});

test("generatePhaseTasks returns optimized scan tasks with confidence and skipped tasks", async () => {
  const context = buildContext({
    recon: {
      alive_hosts: ["https://api.example.com"],
      endpoints: ["/api/user", "/login"],
      technologies: ["Laravel"],
      subdomains: ["api.example.com"],
    },
    scan: null,
  });

  const modelRouter = {
    hasAvailableProviders() {
      return false;
    },
  };

  const result = await generatePhaseTasks({
    target: "example.com",
    phase: "scan",
    mode: "deep",
    context,
    modelRouter,
  });

  assert.equal(result.phase, "scan");
  assert.ok(result.confidence > 0);
  assert.ok(Array.isArray(result.tasks));
  assert.ok(Array.isArray(result.priorityTargets));
});

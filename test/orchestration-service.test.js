import test from "node:test";
import assert from "node:assert/strict";
import { executePhasePlan, getDefaultTasksForPhase } from "../src/services/orchestration-service.js";

test("getDefaultTasksForPhase returns recon template", () => {
  const tasks = getDefaultTasksForPhase("recon");

  assert.ok(Array.isArray(tasks));
  assert.equal(tasks[0].name, "subdomain_enum");
});

test("executePhasePlan uses provided runPhase implementation", async () => {
  const result = await executePhasePlan({
    target: "example.com",
    phase: "recon",
    runPhaseImpl: async (target, phase, tasks) => ({
      target,
      phase,
      status: "success",
      tasks,
      summary: {
        totalTasks: tasks.length,
        successfulTasks: tasks.length,
        failedTasks: 0,
        skippedTasks: 0,
        progress: 100,
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.result.phase, "recon");
  assert.equal(result.result.summary.progress, 100);
});

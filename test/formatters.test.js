import test from "node:test";
import assert from "node:assert/strict";
import { displayProgress, formatCliResponse } from "../src/ui/formatters.js";

function stripAnsi(value) {
  return value.replace(/\x1B\[[0-9;]*m/g, "");
}

test("displayProgress renders a completed phase indicator", () => {
  const output = stripAnsi(displayProgress("recon", "completed"));
  assert.equal(output, "[Recon ✓]");
});

test("formatCliResponse includes section headers and result summaries", () => {
  const output = stripAnsi(formatCliResponse({
    ok: true,
    type: "agent",
    summary: "Executed recon agent for example.com in deep mode.",
    phase: "recon",
    target: "example.com",
    data: {
      status: "success",
      subdomains: ["api.example.com", "dev.example.com"],
      summary: {
        totalTasks: 4,
        successfulTasks: 4,
        progress: 100,
      },
    },
  }));

  assert.match(output, /== Executed recon agent/);
  assert.match(output, /\[Recon ✓\]/);
  assert.match(output, /subdomains: 2/);
  assert.match(output, /tasks: 4\/4 successful/);
});

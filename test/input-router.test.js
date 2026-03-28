import test from "node:test";
import assert from "node:assert/strict";
import { routeUserInput } from "../src/services/input-router.js";

test("routes agent messages to the agent service", async () => {
  const result = await routeUserInput({ mode: "agent", input: "@recon example.com" });

  assert.equal(result.ok, true);
  assert.equal(result.type, "agent");
  assert.equal(result.agent, "recon");
  assert.equal(result.target, "example.com");
});

test("routes file messages to the file command service", async () => {
  const result = await routeUserInput({ mode: "chat", input: "/status example.com" });

  assert.equal(result.ok, true);
  assert.equal(result.type, "file");
  assert.equal(result.command, "status");
});

test("rejects empty input", async () => {
  const result = await routeUserInput({ mode: "chat", input: "   " });

  assert.equal(result.ok, false);
  assert.match(result.error, /No input/i);
});

test("rejects malformed agent targets before execution", async () => {
  const result = await routeUserInput({ mode: "agent", input: "@recon example.com;rm -rf /" });

  assert.equal(result.ok, false);
  assert.match(result.error, /Invalid target/i);
});

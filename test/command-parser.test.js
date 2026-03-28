import test from "node:test";
import assert from "node:assert/strict";
import { parseUserInput } from "../src/core/command-parser.js";

test("parses agent commands", () => {
  const result = parseUserInput("@recon example.com");

  assert.equal(result.type, "agent");
  assert.equal(result.agent, "recon");
  assert.equal(result.payload, "example.com");
});

test("parses file commands", () => {
  const result = parseUserInput("/show recon");

  assert.equal(result.type, "file");
  assert.equal(result.command, "show");
  assert.equal(result.payload, "recon");
});

test("parses standard chat messages", () => {
  const result = parseUserInput("summarize latest recon results");

  assert.equal(result.type, "chat");
  assert.equal(result.message, "summarize latest recon results");
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBanner,
  buildScanInfo,
  buildSystemStatus,
} from "../src/ui/banner.js";

function stripAnsi(value) {
  return value.replace(/\x1B\[[0-9;]*m/g, "");
}

test("buildBanner includes the required ANADEUS content", () => {
  const output = stripAnsi(buildBanner({ blinkStatus: false }));

  assert.match(output, /___   _   _    _    ____  _____ _   _ ____/);
  assert.match(output, /AI-Powered Cybersecurity Warfare System/);
  assert.match(output, /Silence the Noise\. Find the Vulnerability\./);
  assert.match(output, /Mode: CLI-first \| Multi-Agent/);
  assert.match(output, /Status: READY/);
  assert.match(output, /Version: v1\.0\.0/);
  assert.match(output, /Made by Chadna Pandey/);
});

test("buildSystemStatus includes all startup lines", () => {
  const output = stripAnsi(buildSystemStatus());

  assert.match(output, /\[OK\] System Initialized/);
  assert.match(output, /\[OK\] Agents Ready/);
  assert.match(output, /\[OK\] Awaiting Command\.\.\./);
});

test("buildScanInfo includes target, phase, and mode", () => {
  const output = stripAnsi(
    buildScanInfo("example.com", "Reconnaissance", "Deep Recon"),
  );

  assert.match(output, /ANADEUS SCAN PANEL/);
  assert.match(output, /Target: example\.com/);
  assert.match(output, /Current Phase: Reconnaissance/);
  assert.match(output, /Mode: Deep Recon/);
});

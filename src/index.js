#!/usr/bin/env node

import { createProgram } from "./cli/program.js";

function validateTarget(input) {
  const valid = /^[a-zA-Z0-9.-]+$/.test(input);
  if (!valid) throw new Error("Invalid target");
  return input;
}

// EARLY CLI VALIDATION (STRICT)
// Reject invalid target before reaching argument parser
const args = process.argv.slice(2);
for (const arg of args) {
  if (arg.startsWith("@")) {
    const parts = arg.split(/\s+/);
    if (parts.length > 1) {
      validateTarget(parts[1]);
    }
  } else if (!arg.startsWith("-") && arg.includes(";")) {
    validateTarget(arg); // This will throw an error since it has ';'
  }
}

const program = createProgram();
await program.parseAsync(process.argv);

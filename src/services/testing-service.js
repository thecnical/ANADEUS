import { runAllTests } from "../core/testing/test_runner.js";

export function parseTestPayload(payload = "") {
  const [target] = String(payload || "").trim().split(/\s+/, 1);
  return {
    target: target || null,
  };
}

export async function executeTestMode({ target, options = {} }) {
  return runAllTests(target, options);
}

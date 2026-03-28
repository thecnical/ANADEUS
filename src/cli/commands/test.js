import { MODES } from "../../core/modes.js";
import { createCliRuntime } from "../../runtime/create-cli-runtime.js";

export async function runTestMode(target, options = {}) {
  const runtime = createCliRuntime({ mode: MODES.AUTO, json: Boolean(options.json) });
  const trimmedTarget = typeof target === "string" ? target.trim() : "";

  if (!trimmedTarget) {
    runtime.output({
      ok: false,
      mode: MODES.AUTO,
      type: "test",
      error: "Test mode requires a target, for example: anadeus test example.com",
    });
    process.exitCode = 1;
    return;
  }

  const response = await runtime.handleInput(`@test ${trimmedTarget}`);
  runtime.output(response);

  if (!response.ok) {
    process.exitCode = 1;
  }
}

import { MODES } from "../../core/modes.js";
import { createCliRuntime } from "../../runtime/create-cli-runtime.js";

export async function runAgentMode(agent, target = [], options = {}) {
  const runtime = createCliRuntime({ mode: MODES.AGENT, json: Boolean(options.json) });
  const trimmedAgent = typeof agent === "string" ? agent.trim() : "";
  const payload = target.join(" ").trim();

  if (!trimmedAgent) {
    runtime.output({
      ok: false,
      mode: MODES.AGENT,
      error: "Agent mode requires an agent name, for example: anadeus agent recon example.com",
    });
    process.exitCode = 1;
    return;
  }

  const response = await runtime.handleInput(`@${trimmedAgent} ${payload}`.trim());
  runtime.output(response);
}

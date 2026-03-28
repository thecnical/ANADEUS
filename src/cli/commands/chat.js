import { MODES } from "../../core/modes.js";
import { createCliRuntime } from "../../runtime/create-cli-runtime.js";
import { startInteractiveShell } from "../../ui/interactive-shell.js";

export async function runChatMode(options = {}) {
  const runtime = createCliRuntime({ mode: MODES.CHAT, json: Boolean(options.json) });

  if (options.message) {
    const response = await runtime.handleInput(options.message);
    runtime.output(response);
    return;
  }

  await startInteractiveShell(runtime);
}

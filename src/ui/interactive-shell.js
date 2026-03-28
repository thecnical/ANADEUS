import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { displayBanner, displaySystemStatus } from "./banner.js";

export async function startInteractiveShell(runtime) {
  const rl = readline.createInterface({ input, output });

  await displayBanner();
  displaySystemStatus();
  output.write("ANADEUS chat mode initialized. Type 'exit' to quit.\n");

  try {
    while (true) {
      const line = await rl.question("> ");
      const normalized = line.trim();

      if (!normalized) {
        continue;
      }

      if (normalized === "exit" || normalized === "quit") {
        output.write("Session closed.\n");
        break;
      }

      const response = await runtime.handleInput(normalized);
      runtime.output(response);
    }
  } finally {
    rl.close();
  }
}

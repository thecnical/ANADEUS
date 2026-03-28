import { Command } from "commander";
import { APP_VERSION } from "../config/defaults.js";
import { runAgentMode } from "./commands/agent.js";
import { runAutoMode } from "./commands/auto.js";
import { runBannerMode } from "./commands/banner.js";
import { runChatMode } from "./commands/chat.js";
import { runDashboardMode } from "./commands/dashboard.js";
import { runPhaseMode } from "./commands/phase.js";
import { runTestMode } from "./commands/test.js";

export function createProgram() {
  const program = new Command();

  program
    .name("anadeus")
    .description(
      "AI-assisted cybersecurity orchestration platform for ethical security testing.",
    )
    .version(APP_VERSION);

  program
    .command("banner")
    .description("Render the ANADEUS terminal banner and system status.")
    .action(runBannerMode);

  program
    .command("dashboard")
    .description("Start the local ANADEUS web dashboard.")
    .option("--host <host>", "Host to bind the dashboard server.", "127.0.0.1")
    .option("--port <port>", "Port to bind the dashboard server.", "4173")
    .action(runDashboardMode);

  program
    .command("chat")
    .description("Run ANADEUS in chat mode.")
    .option("-m, --message <message>", "Process a single message and exit.")
    .option("--json", "Emit structured JSON output.")
    .action(runChatMode);

  program
    .command("agent")
    .description("Run ANADEUS in agent mode for a specific agent and target.")
    .argument("[agent]", "Agent name, for example recon.")
    .argument("[target...]", "Target or task arguments.")
    .option("--json", "Emit structured JSON output.")
    .action(runAgentMode);

  program
    .command("auto")
    .description("Run ANADEUS in auto mode across the full pipeline or a single phase.")
    .option("-g, --goal <goal>", "High-level automation goal.")
    .option("-t, --target <target>", "Target to execute against.")
    .option("-p, --phase <phase>", "Phase to execute, for example recon.")
    .option("--deep", "Run the full pipeline in deep mode.")
    .option("--light", "Run the full pipeline in light mode.")
    .option("--tasks-file <path>", "Optional JSON file containing task definitions.")
    .option("--force", "Re-run tasks even if successful results already exist.")
    .option("--json", "Emit structured JSON output.")
    .action(runAutoMode);

  program
    .command("phase")
    .description("Run a saved ANADEUS phase through the orchestrator engine.")
    .argument("<phase>", "Phase to execute, for example recon.")
    .argument("<target>", "Target to execute against.")
    .option("--tasks-file <path>", "Optional JSON file containing task definitions.")
    .option("--force", "Re-run tasks even if successful results already exist.")
    .option("--json", "Emit structured JSON output.")
    .action(runPhaseMode);

  program
    .command("test")
    .description("Run all major phases and validate their outputs.")
    .argument("<target>", "Target to test.")
    .option("--json", "Emit structured JSON output.")
    .action(runTestMode);

  program.action(runChatMode);
  program.addHelpText(
    "after",
    "\nExamples:\n" +
      "  anadeus banner\n" +
      "  anadeus dashboard --port 4173\n" +
      "  anadeus phase recon example.com --json\n" +
      "  anadeus test example.com --json\n" +
      "  anadeus auto --target example.com --deep\n" +
      "  anadeus chat --message \"summarize scope\"\n" +
      "  anadeus chat --message \"@recon example.com\"\n" +
      "  anadeus chat --message \"@auto example.com --deep\"\n" +
      "  anadeus chat --message \"@test example.com\"\n" +
      "  anadeus chat --message \"/show recon example.com\"\n" +
      "  anadeus agent recon example.com --json\n",
  );

  return program;
}

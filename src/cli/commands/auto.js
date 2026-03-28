import { MODES } from "../../core/modes.js";
import { createCliRuntime } from "../../runtime/create-cli-runtime.js";
import { executeIntegratedAuto } from "../../services/integration-service.js";
import { executePhasePlan } from "../../services/orchestration-service.js";

export async function runAutoMode(options = {}) {
  const runtime = createCliRuntime({ mode: MODES.AUTO, json: Boolean(options.json) });
  const goal = options.goal?.trim();
  const target = options.target?.trim();
  const phase = options.phase?.trim();
  const mode = options.light ? "light" : "deep";

  if (target && phase) {
    const result = await executePhasePlan({
      target,
      phase,
      tasksFile: options.tasksFile,
      force: Boolean(options.force),
    });
    runtime.output(result.ok ? {
      ok: true,
      mode: MODES.AUTO,
      type: "phase",
      summary: `Executed ${phase} phase for ${target}.`,
      phase,
      target,
      data: result.result,
    } : {
      ok: false,
      mode: MODES.AUTO,
      error: result.error,
    });
    return;
  }

  if (target) {
    const result = await executeIntegratedAuto({
      target,
      mode,
      options: {
        force: Boolean(options.force),
      },
    });
    runtime.output(result);
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (!goal) {
    runtime.output({
      ok: true,
      mode: MODES.AUTO,
      type: "system",
      message:
        "Auto mode is initialized. Provide --target to run the full pipeline, --target with --phase to run a single phase, or --goal for AI-assisted intent capture.",
      next: [
        "Example: anadeus auto --target example.com --deep",
      ],
    });
    return;
  }

  const response = await runtime.handleAutoGoal(goal);
  runtime.output(response);
}

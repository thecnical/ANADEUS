import { executePhasePlan } from "../../services/orchestration-service.js";

export async function runPhaseMode(phase, target, options = {}) {
  const result = await executePhasePlan({
    target,
    phase,
    tasksFile: options.tasksFile,
    force: Boolean(options.force),
  });

  const output = options.json ? JSON.stringify(result, null, 2) : formatPhaseCommandOutput(result);
  process.stdout.write(`${output}\n`);

  if (!result.ok) {
    process.exitCode = 1;
  }
}

function formatPhaseCommandOutput(result) {
  if (!result.ok) {
    return `[error] ${result.error}`;
  }

  const phaseResult = result.result;
  const lines = [
    `phase: ${phaseResult.phase}`,
    `target: ${phaseResult.target}`,
    `status: ${phaseResult.status}`,
    `progress: ${phaseResult.summary.progress}%`,
  ];

  for (const task of phaseResult.tasks) {
    lines.push(`task ${task.name}: ${task.status}${task.selectedTool ? ` via ${task.selectedTool}` : ""}`);
  }

  return lines.join("\n");
}

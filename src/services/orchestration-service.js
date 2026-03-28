import { readFile } from "node:fs/promises";
import { runPhase as runPhaseImplDefault } from "../../orchestrator/orchestrator.js";
import { runAnalysis } from "../../agents/analysis/analysis_agent.js";
import { runExploit } from "../../agents/exploit/exploit_agent.js";
import { runReport } from "../../agents/report/report_agent.js";
import { PHASE_TASK_TEMPLATES } from "../config/phase-task-templates.js";

export function getDefaultTasksForPhase(phase) {
  const tasks = PHASE_TASK_TEMPLATES[String(phase || "").trim().toLowerCase()];
  return tasks ? structuredClone(tasks) : null;
}

export async function loadTasksFromFile(tasksFile) {
  const rawContent = await readFile(tasksFile, "utf8");
  const parsed = JSON.parse(rawContent);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)) {
    return parsed.tasks;
  }

  throw new Error("Tasks file must contain either a JSON array or an object with a tasks array.");
}

export async function executePhasePlan({
  target,
  phase,
  tasks,
  tasksFile,
  force = false,
  runPhaseImpl = runPhaseImplDefault,
}) {
  const normalizedPhase = String(phase || "").trim().toLowerCase();

  if ((normalizedPhase === "analysis" || normalizedPhase === "exploit" || normalizedPhase === "report") && !tasks && !tasksFile) {
    const result = normalizedPhase === "analysis"
      ? await runAnalysis(target)
      : normalizedPhase === "exploit"
        ? await runExploit(target)
        : await runReport(target);
    return {
      ok: result.status !== "error",
      type: "phase",
      phase: normalizedPhase,
      target,
      result,
    };
  }

  let resolvedTasks = tasks;

  if (!resolvedTasks && tasksFile) {
    resolvedTasks = await loadTasksFromFile(tasksFile);
  }

  if (!resolvedTasks) {
    resolvedTasks = getDefaultTasksForPhase(phase);
  }

  if (!resolvedTasks) {
    return {
      ok: false,
      type: "phase",
      phase: normalizedPhase,
      target,
      error: `No task template is configured for phase '${phase}'. Provide a tasks file to run it manually.`,
    };
  }

  const result = await runPhaseImpl(target, normalizedPhase, resolvedTasks, { force });
  return {
    ok: result.status !== "error",
    type: "phase",
    phase: normalizedPhase,
    target,
    result,
  };
}

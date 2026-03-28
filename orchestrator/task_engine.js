export const TOOL_OPTION_SCHEMA = {
  amass: ["passive", "brute"],
  assetfinder: [],
  dirsearch: ["wordlist", "extensions", "threads", "status_codes"],
  feroxbuster: ["wordlist", "threads", "status_codes"],
  ffuf: ["url", "wordlist", "method", "headers", "match_codes", "filter_codes", "rate", "auto_fuzz_path"],
  httpx: ["follow_redirects", "status_code", "threads", "title"],
  nikto: ["timeout", "tuning"],
  nmap: ["ports", "service_version", "top_ports", "scripts", "timing_template"],
  routeprobe: ["timeout", "paths"],
  socketprobe: ["ports", "timeout", "top_ports"],
  subfinder: ["all", "recursive", "max_time"],
  webprobe: ["timeout", "port"],
  whatweb: ["aggression"],
};

function normalizeToolDefinition(tool) {
  if (typeof tool === "string") {
    return {
      name: tool,
      options: {},
    };
  }

  if (tool && typeof tool === "object" && typeof tool.name === "string") {
    return {
      name: tool.name,
      options: tool.options || {},
    };
  }

  throw new Error("Each tool entry must be a string or an object with a name property.");
}

function validateTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("Tasks must be a non-empty array.");
  }

  return tasks.map((task, index) => {
    if (!task || typeof task !== "object") {
      throw new Error(`Task at index ${index} must be an object.`);
    }

    if (!task.name || typeof task.name !== "string") {
      throw new Error(`Task at index ${index} requires a string 'name'.`);
    }

    if (!Array.isArray(task.tools) || task.tools.length === 0) {
      throw new Error(`Task '${task.name}' requires a non-empty 'tools' array.`);
    }

    return {
      name: task.name,
      tools: task.tools.map(normalizeToolDefinition),
      options: task.options || {},
      retries: Number.isInteger(task.retries) ? task.retries : 0,
      continueOnFailure: Boolean(task.continueOnFailure),
    };
  });
}

function buildProgress(index, total) {
  return {
    completed: index,
    total,
    percentage: total === 0 ? 0 : Number(((index / total) * 100).toFixed(2)),
  };
}

export function sanitizeOptions(toolName, options = {}) {
  const allowed = TOOL_OPTION_SCHEMA[String(toolName || "").toLowerCase()] || [];
  return Object.fromEntries(
    Object.entries(options || {}).filter(([key]) => allowed.includes(key)),
  );
}

function getExistingSuccessfulTask(existingPhaseData, taskName) {
  const tasks = existingPhaseData?.tasks;
  if (!Array.isArray(tasks)) {
    return null;
  }

  return tasks.find((task) => task.name === taskName && task.status === "success") || null;
}

export async function executeTasks({
  target,
  phase,
  tasks,
  context,
  existingPhaseData,
  executeTool,
  logger,
  force = false,
}) {
  const normalizedTasks = validateTasks(tasks);
  const taskResults = [];

  for (const [taskIndex, task] of normalizedTasks.entries()) {
    const previousSuccess = !force ? getExistingSuccessfulTask(existingPhaseData, task.name) : null;
    if (previousSuccess) {
      taskResults.push({
        ...previousSuccess,
        status: "skipped",
        skipped: true,
        message: "Task skipped because an existing successful result was found.",
        progress: buildProgress(taskIndex + 1, normalizedTasks.length),
      });
      await logger.info("task_skipped", { phase, target, task: task.name });
      continue;
    }

    await logger.info("task_started", { phase, target, task: task.name });
    const attempts = [];
    let taskSuccess = null;

    for (const tool of task.tools) {
      for (let attempt = 0; attempt <= task.retries; attempt += 1) {
        const toolInput = {
          target,
          phase,
          context: {
            ...context,
            previousTaskResults: taskResults,
          },
          task,
          taskOptions: task.options,
          toolOptions: tool.options,
          attempt,
        };

        const result = await executeTool(tool.name, target, sanitizeOptions(tool.name, {
          ...task.options,
          ...tool.options,
        }), toolInput);

        attempts.push({
          tool: tool.name,
          attempt: attempt + 1,
          result,
        });

        await logger.info("tool_executed", {
          phase,
          target,
          task: task.name,
          tool: tool.name,
          status: result.status,
        });

        if (result.status === "success") {
          taskSuccess = {
            name: task.name,
            status: "success",
            selectedTool: tool.name,
            attempts,
            data: result.data || {},
            rawOutput: result.raw_output || "",
            executionTime: result.execution_time || 0,
          };
          break;
        }
      }

      if (taskSuccess) {
        break;
      }
    }

    if (!taskSuccess) {
      const failure = {
        name: task.name,
        status: "failed",
        selectedTool: null,
        attempts,
        error: "All tools failed for this task.",
      };
      taskResults.push({
        ...failure,
        progress: buildProgress(taskIndex + 1, normalizedTasks.length),
      });
      await logger.warn("task_failed", { phase, target, task: task.name });

      if (!task.continueOnFailure) {
        return {
          status: "error",
          taskResults,
          failedTask: failure,
        };
      }

      continue;
    }

    taskResults.push({
      ...taskSuccess,
      progress: buildProgress(taskIndex + 1, normalizedTasks.length),
    });
    await logger.info("task_completed", { phase, target, task: task.name, tool: taskSuccess.selectedTool });
  }

  return {
    status: taskResults.some((task) => task.status === "failed") ? "partial" : "success",
    taskResults,
    failedTask: null,
  };
}

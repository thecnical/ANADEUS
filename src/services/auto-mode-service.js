import { createModelRouter } from "../core/ai/model_router.js";
import { buildChatPrompt } from "../core/ai/prompt_engine.js";
import { loadTargetContext } from "../core/ai/context_engine.js";
import { runAutoPipeline } from "../core/ai/decision_engine.js";

export async function executeAutoMode({ target, mode = "deep", options = {} }) {
  return runAutoPipeline(target, {
    ...options,
    mode,
    modelRouter: options.modelRouter || createModelRouter(options),
  });
}

export async function interpretAutoGoal(goal, options = {}) {
  const modelRouter = options.modelRouter || createModelRouter(options);

  if (!modelRouter.hasAvailableProviders()) {
    return {
      ok: true,
      type: "auto-goal",
      goal,
      summary: `Auto mode captured goal: ${goal}`,
      next: [
        "Provide --target to run the full pipeline automatically.",
        "Configure BYTEZ_* or OPENROUTER_* environment variables to enable AI goal interpretation.",
      ],
    };
  }

  const target = options.target || extractTargetFromGoal(goal);
  const context = target ? await loadTargetContext(target, options).catch(() => ({ target })) : {};
  const response = await modelRouter.generateText({
    prompt: buildChatPrompt({
      message: `Interpret this ANADEUS auto-mode goal and give a concise execution recommendation: ${goal}`,
      context,
    }),
    temperature: 0.2,
    maxTokens: 500,
  });

  return {
    ok: true,
    type: "auto-goal",
    goal,
    provider: response.provider,
    summary: "AI interpreted the requested auto-mode goal.",
    message: response.text,
  };
}

export function parseAutoPayload(payload = "") {
  const parts = String(payload || "").trim().split(/\s+/).filter(Boolean);
  let target = null;
  let mode = "deep";

  for (const part of parts) {
    if (part === "--light") {
      mode = "light";
      continue;
    }

    if (part === "--deep") {
      mode = "deep";
      continue;
    }

    if (!part.startsWith("--") && !target) {
      target = part;
    }
  }

  return {
    target,
    mode,
  };
}

function extractTargetFromGoal(goal = "") {
  const match = String(goal).match(/\b([a-z0-9.-]+\.[a-z]{2,})\b/i);
  return match ? match[1].toLowerCase() : null;
}

import { APP_NAME } from "../config/defaults.js";
import { createModelRouter } from "../core/ai/model_router.js";
import { buildChatPrompt } from "../core/ai/prompt_engine.js";

export async function handleChatMessage({ mode, parsed }) {
  const modelRouter = createModelRouter();

  if (modelRouter.hasAvailableProviders()) {
    try {
      const response = await modelRouter.generateText({
        prompt: buildChatPrompt({
          message: parsed.message,
          context: {},
        }),
        temperature: 0.2,
        maxTokens: 600,
      });

      return {
        ok: true,
        app: APP_NAME,
        mode,
        type: "chat",
        input: parsed.raw,
        summary: `AI response generated via ${response.provider}.`,
        message: response.text,
        provider: response.provider,
        status: "ai-response",
      };
    } catch (error) {
      return buildFallbackChatResponse({ mode, parsed, detail: error.message });
    }
  }

  return buildFallbackChatResponse({ mode, parsed });
}

function buildFallbackChatResponse({ mode, parsed, detail = null }) {
  const lowerMessage = String(parsed.message || "").toLowerCase();
  let message = "Captured chat message for future AI reasoning.";
  let next = [
    "Use @recon <target> or @scanner <target> to execute the orchestrator.",
    "Use /show <phase> <target> or /status <target> to inspect workspace data.",
  ];

  if (lowerMessage.includes("sql injection")) {
    message = "SQL injection happens when untrusted input reaches a database query without safe parameterization, letting an attacker alter query behavior.";
    next = [
      "Use @analysis <target> after recon and scan to rank likely injection points.",
      "Use @exploit <target> to run low-impact SQL validation only.",
    ];
  } else if (lowerMessage.includes("xss")) {
    message = "Cross-site scripting occurs when attacker-controlled content is rendered in a browser without proper output encoding or sanitization.";
    next = [
      "Use @analysis <target> to prioritize reflected and stored XSS candidates.",
      "Use @exploit <target> to run harmless reflection checks.",
    ];
  }

  return {
    ok: true,
    app: APP_NAME,
    mode,
    type: "chat",
    input: parsed.raw,
    summary: detail
      ? `AI was unavailable, so ANADEUS returned a local response. ${detail}`
      : "AI is not configured, so ANADEUS returned a local response.",
    message,
    status: "local-response",
    next,
  };
}

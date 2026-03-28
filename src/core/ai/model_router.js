const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function createModelRouter(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const providers = resolveProviders(options);

  return {
    providers,
    hasAvailableProviders() {
      return providers.length > 0;
    },
    async generateText(input) {
      const result = await runProviderFallback({
        input,
        providers,
        fetchImpl,
        responseMode: "text",
      });

      return {
        provider: result.provider,
        model: result.model,
        text: result.content,
      };
    },
    async generateObject(input) {
      const result = await runProviderFallback({
        input,
        providers,
        fetchImpl,
        responseMode: "json",
      });

      return {
        provider: result.provider,
        model: result.model,
        object: extractJson(result.content),
      };
    },
  };
}

function resolveProviders(options = {}) {
  const bytezApiKey = options.bytezApiKey || process.env.BYTEZ_API_KEY || "";
  const bytezBaseUrl = options.bytezBaseUrl || process.env.BYTEZ_BASE_URL || process.env.BYTEZ_API_BASE_URL || "";
  const bytezModel = options.bytezModel || process.env.BYTEZ_MODEL || "";

  const openRouterApiKey = options.openRouterApiKey || process.env.OPENROUTER_API_KEY || "";
  const openRouterBaseUrl = options.openRouterBaseUrl || process.env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_URL;
  const openRouterModel = options.openRouterModel || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  const providers = [];

  if (bytezApiKey && bytezBaseUrl && bytezModel) {
    providers.push({
      name: "bytez",
      url: normalizeChatCompletionsUrl(bytezBaseUrl),
      apiKey: bytezApiKey,
      model: bytezModel,
      headers: {},
    });
  }

  if (openRouterApiKey) {
    providers.push({
      name: "openrouter",
      url: normalizeChatCompletionsUrl(openRouterBaseUrl),
      apiKey: openRouterApiKey,
      model: openRouterModel,
      headers: {
        "HTTP-Referer": options.httpReferer || process.env.OPENROUTER_HTTP_REFERER || "https://anadeus.local",
        "X-Title": options.appTitle || "ANADEUS",
      },
    });
  }

  return providers;
}

async function runProviderFallback({ input, providers, fetchImpl, responseMode }) {
  if (providers.length === 0) {
    throw new Error("No AI providers are configured. Set BYTEZ_* or OPENROUTER_* environment variables.");
  }

  const failures = [];

  for (const provider of providers) {
    try {
      const content = await invokeProvider(provider, input, fetchImpl, responseMode);
      return {
        provider: provider.name,
        model: provider.model,
        content,
      };
    } catch (error) {
      failures.push(`${provider.name}: ${error.message}`);
    }
  }

  throw new Error(`All AI providers failed. ${failures.join(" | ")}`);
}

async function invokeProvider(provider, input, fetchImpl, responseMode) {
  const payload = {
    model: provider.model,
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 1200,
    messages: buildMessages(input),
  };

  if (responseMode === "json") {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetchImpl(provider.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
      ...provider.headers,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await safeReadText(response);
    throw new Error(`HTTP ${response.status}${errorBody ? `: ${errorBody.slice(0, 200)}` : ""}`);
  }

  const parsed = await response.json();
  const content = parsed?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Provider returned an empty completion.");
  }

  return content;
}

function buildMessages(input = {}) {
  if (Array.isArray(input.messages) && input.messages.length > 0) {
    return input.messages;
  }

  const messages = [];
  if (input.system) {
    messages.push({
      role: "system",
      content: input.system,
    });
  }

  if (input.prompt) {
    messages.push({
      role: "user",
      content: input.prompt,
    });
  }

  return messages;
}

function extractJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch) {
      return JSON.parse(fencedMatch[1]);
    }

    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(content.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("AI response did not contain valid JSON.");
  }
}

function normalizeChatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || "").replace(/\/+$/, "");
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

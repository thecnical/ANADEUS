import test from "node:test";
import assert from "node:assert/strict";
import { createModelRouter } from "../src/core/ai/model_router.js";

function createJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("model router falls back from Bytez to OpenRouter", async () => {
  const calls = [];
  const router = createModelRouter({
    bytezApiKey: "bytez-key",
    bytezBaseUrl: "https://bytez.example/v1",
    bytezModel: "bytez/model",
    openRouterApiKey: "openrouter-key",
    openRouterBaseUrl: "https://openrouter.example/api/v1",
    openRouterModel: "openai/gpt-4o-mini",
    fetchImpl: async (url) => {
      calls.push(url);
      if (String(url).includes("bytez.example")) {
        return createJsonResponse(500, { error: "upstream failed" });
      }

      return createJsonResponse(200, {
        choices: [
          {
            message: {
              content: "{\"answer\":\"fallback-ok\"}",
            },
          },
        ],
      });
    },
  });

  const result = await router.generateObject({
    prompt: "Return JSON only.",
  });

  assert.equal(result.provider, "openrouter");
  assert.equal(result.object.answer, "fallback-ok");
  assert.equal(calls.length, 2);
});

test("model router returns text from the first successful provider", async () => {
  const router = createModelRouter({
    openRouterApiKey: "openrouter-key",
    openRouterBaseUrl: "https://openrouter.example/api/v1",
    openRouterModel: "openai/gpt-4o-mini",
    fetchImpl: async () => createJsonResponse(200, {
      choices: [
        {
          message: {
            content: "hello from router",
          },
        },
      ],
    }),
  });

  const result = await router.generateText({
    prompt: "Say hello",
  });

  assert.equal(result.provider, "openrouter");
  assert.equal(result.text, "hello from router");
});

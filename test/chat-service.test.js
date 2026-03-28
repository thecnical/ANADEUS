import test from "node:test";
import assert from "node:assert/strict";
import { handleChatMessage } from "../src/services/chat-service.js";

test("chat service returns a local fallback explanation when AI is not configured", async () => {
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
  const originalBytezKey = process.env.BYTEZ_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.BYTEZ_API_KEY;

  try {
    const result = await handleChatMessage({
      mode: "chat",
      parsed: {
        raw: "explain sql injection",
        message: "explain sql injection",
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.type, "chat");
    assert.equal(result.status, "local-response");
    assert.match(result.message, /SQL injection/i);
  } finally {
    if (originalOpenRouterKey !== undefined) {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
    }
    if (originalBytezKey !== undefined) {
      process.env.BYTEZ_API_KEY = originalBytezKey;
    }
  }
});

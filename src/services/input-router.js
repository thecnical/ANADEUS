import { parseUserInput } from "../core/command-parser.js";
import { handleAgentCommand } from "./agent-command-service.js";
import { handleChatMessage } from "./chat-service.js";
import { handleFileCommand } from "./file-command-service.js";

const AGENT_INPUT_PATTERN = /^@(?<agent>[a-z0-9_-]+)\b\s*(?<payload>.*)$/i;
const TARGETED_AGENTS = new Set(["recon", "scanner", "scan", "analysis", "exploit", "report", "auto", "test"]);

export function validateTarget(input) {
  const normalized = String(input || "").trim();
  const valid = /^[a-zA-Z0-9.-]+$/.test(normalized);
  if (!valid) {
    throw new Error("Invalid target");
  }
  return normalized;
}

function validateAgentInput(rawInput) {
  const raw = String(rawInput || "").trim();
  const match = raw.match(AGENT_INPUT_PATTERN);
  if (!match?.groups) {
    return;
  }

  const agent = match.groups.agent.toLowerCase();
  if (!TARGETED_AGENTS.has(agent)) {
    return;
  }

  const payload = String(match.groups.payload || "").trim();
  if (!payload) {
    return;
  }

  const targetToken = payload.split(/\s+/).find((part) => !part.startsWith("--"));
  if (targetToken) {
    validateTarget(targetToken);
  }
}

export async function routeUserInput({ mode, input }) {
  try {
    validateAgentInput(input);
  } catch (error) {
    return {
      ok: false,
      mode,
      type: "error",
      error: error.message,
    };
  }

  const parsed = parseUserInput(input);

  switch (parsed.type) {
    case "agent":
      return handleAgentCommand({ mode, parsed });
    case "file":
      return handleFileCommand({ mode, parsed });
    case "chat":
      return handleChatMessage({ mode, parsed });
    case "empty":
    default:
      return {
        ok: false,
        mode,
        type: "error",
        error: "No input received.",
      };
  }
}

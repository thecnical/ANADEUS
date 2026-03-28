const AGENT_PATTERN = /^@(?<agent>[a-z0-9_-]+)\b\s*(?<payload>.*)$/i;
const FILE_PATTERN = /^\/(?<command>[a-z0-9_-]+)\b\s*(?<payload>.*)$/i;

export function parseUserInput(input) {
  const raw = String(input ?? "").trim();

  if (!raw) {
    return {
      type: "empty",
      raw,
    };
  }

  const agentMatch = raw.match(AGENT_PATTERN);
  if (agentMatch?.groups) {
    return {
      type: "agent",
      raw,
      agent: agentMatch.groups.agent.toLowerCase(),
      payload: agentMatch.groups.payload.trim(),
    };
  }

  const fileMatch = raw.match(FILE_PATTERN);
  if (fileMatch?.groups) {
    return {
      type: "file",
      raw,
      command: fileMatch.groups.command.toLowerCase(),
      payload: fileMatch.groups.payload.trim(),
    };
  }

  return {
    type: "chat",
    raw,
    message: raw,
  };
}

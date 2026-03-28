import { APP_NAME, FILE_COMMAND_HINTS } from "../config/defaults.js";
import { readWorkspaceArtifact } from "./workspace-file-service.js";

export async function handleFileCommand({ mode, parsed }) {
  const response = await readWorkspaceArtifact(parsed.command, parsed.payload);
  return {
    app: APP_NAME,
    mode,
    input: parsed.raw,
    supportedCommands: FILE_COMMAND_HINTS,
    ...response,
  };
}

import {
  getPhaseFilePath,
  getTargetWorkspacePath,
  loadMeta,
  loadPhaseData,
} from "../../orchestrator/phase_manager.js";

export async function readWorkspaceArtifact(command, payload, options = {}) {
  const parts = String(payload || "").trim().split(/\s+/).filter(Boolean);

  if (command === "status") {
    const [target] = parts;
    if (!target) {
      return {
        ok: false,
        type: "file",
        error: "Usage: /status <target>",
      };
    }

    const meta = await loadMeta(target, options);
    return {
      ok: true,
      type: "file",
      command,
      target,
      summary: `Loaded workspace status for ${target}.`,
      data: meta,
    };
  }

  if (command === "list") {
    const [target] = parts;
    if (!target) {
      return {
        ok: false,
        type: "file",
        error: "Usage: /list <target>",
      };
    }

    const meta = await loadMeta(target, options);
    return {
      ok: true,
      type: "file",
      command,
      target,
      summary: `Listed phase state for ${target}.`,
      data: meta.phases || {},
    };
  }

  if (command === "show" || command === "open") {
    const [phase, target] = parts;
    if (!phase || !target) {
      return {
        ok: false,
        type: "file",
        error: `Usage: /${command} <phase> <target>`,
      };
    }

    const data = await loadPhaseData(target, phase, options);
    if (!data) {
      return {
        ok: false,
        type: "file",
        error: `No saved data found for phase '${phase}' and target '${target}'.`,
      };
    }

    return {
      ok: true,
      type: "file",
      command,
      phase,
      target,
      location: getPhaseFilePath(target, phase, options),
      workspace: getTargetWorkspacePath(target, options),
      summary: `Loaded ${phase} data for ${target}.`,
      data,
    };
  }

  return {
    ok: false,
    type: "file",
    error: `Unsupported file command '/${command}'.`,
  };
}

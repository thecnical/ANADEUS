import { APP_NAME, DEFAULT_AGENT_HINTS } from "../config/defaults.js";
import { AGENT_PHASE_MAP } from "../config/phase-task-templates.js";
import { parseAutoPayload } from "./auto-mode-service.js";
import { executeIntegratedAuto, executeIntegratedPhase } from "./integration-service.js";
import { executePhasePlan } from "./orchestration-service.js";
import { executeTestMode, parseTestPayload } from "./testing-service.js";

export async function handleAgentCommand({ mode, parsed }) {
  const hasPayload = Boolean(parsed.payload);
  const mappedPhase = AGENT_PHASE_MAP[parsed.agent];

  if (hasPayload && parsed.agent === "recon") {
    const [target, requestedMode] = parsed.payload.split(/\s+/, 2);
    const reconResult = await executeIntegratedPhase({
      phase: "recon",
      target,
      mode: requestedMode || "deep",
    });

    return {
      ok: reconResult.status !== "error",
      app: APP_NAME,
      mode,
      type: "agent",
      agent: parsed.agent,
      phase: "recon",
      input: parsed.raw,
      target,
      summary: `Executed recon agent for ${target} in ${requestedMode || "deep"} mode.`,
      data: reconResult,
    };
  }

  if (hasPayload && (parsed.agent === "scanner" || parsed.agent === "scan")) {
    const [target, requestedMode] = parsed.payload.split(/\s+/, 2);
    const scanResult = await executeIntegratedPhase({
      phase: "scan",
      target,
      mode: requestedMode || "deep",
    });

    return {
      ok: scanResult.status !== "error",
      app: APP_NAME,
      mode,
      type: "agent",
      agent: "scan",
      phase: "scan",
      input: parsed.raw,
      target,
      summary: `Executed scanner agent for ${target} in ${requestedMode || "deep"} mode.`,
      data: scanResult,
    };
  }

  if (hasPayload && parsed.agent === "analysis") {
    const [target] = parsed.payload.split(/\s+/, 1);
    const analysisResult = await executeIntegratedPhase({
      phase: "analysis",
      target,
    });

    return {
      ok: analysisResult.status !== "error",
      app: APP_NAME,
      mode,
      type: "agent",
      agent: parsed.agent,
      phase: "analysis",
      input: parsed.raw,
      target,
      summary: `Executed analysis agent for ${target}.`,
      data: analysisResult,
    };
  }

  if (hasPayload && parsed.agent === "exploit") {
    const [target, requestedMode] = parsed.payload.split(/\s+/, 2);
    const exploitResult = await executeIntegratedPhase({
      phase: "exploit",
      target,
      mode: requestedMode || "safe",
    });

    return {
      ok: exploitResult.status !== "error",
      app: APP_NAME,
      mode,
      type: "agent",
      agent: parsed.agent,
      phase: "exploit",
      input: parsed.raw,
      target,
      summary: `Executed exploit agent for ${target} in ${requestedMode || "safe"} mode.`,
      data: exploitResult,
    };
  }

  if (hasPayload && parsed.agent === "report") {
    const [target] = parsed.payload.split(/\s+/, 1);
    const reportResult = await executeIntegratedPhase({
      phase: "report",
      target,
    });

    return {
      ok: reportResult.status !== "error",
      app: APP_NAME,
      mode,
      type: "agent",
      agent: parsed.agent,
      phase: "report",
      input: parsed.raw,
      target,
      summary: `Executed report agent for ${target}.`,
      data: reportResult,
    };
  }

  if (hasPayload && parsed.agent === "auto") {
    const autoRequest = parseAutoPayload(parsed.payload);
    if (!autoRequest.target) {
      return {
        ok: false,
        app: APP_NAME,
        mode,
        type: "auto",
        error: "Usage: @auto <target> [--deep|--light]",
      };
    }

    const autoResult = await executeIntegratedAuto({
      target: autoRequest.target,
      mode: autoRequest.mode,
      options: {},
    });

    return {
      app: APP_NAME,
      mode,
      agent: parsed.agent,
      input: parsed.raw,
      ...autoResult,
    };
  }

  if (hasPayload && parsed.agent === "test") {
    const testRequest = parseTestPayload(parsed.payload);
    if (!testRequest.target) {
      return {
        ok: false,
        app: APP_NAME,
        mode,
        type: "test",
        error: "Usage: @test <target>",
      };
    }

    const testResult = await executeTestMode({
      target: testRequest.target,
      options: {},
    });

    return {
      ok: testResult.status !== "fail",
      app: APP_NAME,
      mode,
      agent: parsed.agent,
      input: parsed.raw,
      ...testResult,
      summary: `Testing completed for ${testRequest.target}.`,
      target: testRequest.target,
    };
  }

  if (hasPayload && mappedPhase && mappedPhase !== "auto") {
    const result = await executePhasePlan({
      target: parsed.payload,
      phase: mappedPhase,
    });

    if (result.ok) {
      return {
        ok: true,
        app: APP_NAME,
        mode,
        type: "agent",
        agent: parsed.agent,
        phase: mappedPhase,
        input: parsed.raw,
        target: parsed.payload,
        summary: `Executed ${mappedPhase} phase for ${parsed.payload} via ${parsed.agent} agent.`,
        data: result.result,
      };
    }

    return {
      ok: false,
      app: APP_NAME,
      mode,
      type: "agent",
      agent: parsed.agent,
      target: parsed.payload,
      error: result.error,
    };
  }

  return {
    ok: true,
    app: APP_NAME,
    mode,
    type: "agent",
    agent: parsed.agent,
    input: parsed.raw,
    target: hasPayload ? parsed.payload : null,
    summary: hasPayload
      ? `Queued ${parsed.agent} agent request for ${parsed.payload}.`
      : `Initialized ${parsed.agent} agent without a target.`,
    status: "awaiting-phase-template",
    next: [
      "Use @recon <target> to execute the recon phase immediately.",
      "Use @scan <target> to execute the scan phase immediately.",
      "Use @analysis <target> to generate vulnerability candidates from recon and scan data.",
      "Use @exploit <target> to generate safe verification plans from analysis results.",
      "Use @report <target> to generate impact analysis and a submission-ready report.",
      "Use @auto <target> --deep to run the full intelligent pipeline.",
      "Use @test <target> to execute and validate every major phase.",
    ],
    hints: hasPayload ? [] : DEFAULT_AGENT_HINTS,
  };
}

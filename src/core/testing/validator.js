import { readFile } from "node:fs/promises";
import { getValidationConfig } from "./rules.js";

export async function validatePhaseOutput(phase, target, options = {}) {
  const config = getValidationConfig(phase, target, options);

  try {
    const raw = await readFile(config.artifactPath, "utf8");
    const parsed = JSON.parse(raw);
    const missingField = config.requiredFields.find((field) => parsed[field] === undefined || parsed[field] === null);

    if (missingField) {
      return buildValidationResult("error", phase, `Missing required field '${missingField}'.`, config.artifactPath);
    }

    const result = config.validator(parsed, target, options);
    return buildValidationResult(result.status, phase, result.issue, config.artifactPath, parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      return buildValidationResult("error", phase, "Expected output file was not found.", config.artifactPath);
    }

    if (error.name === "SyntaxError") {
      return buildValidationResult("error", phase, "Output file contains invalid JSON.", config.artifactPath);
    }

    return buildValidationResult("error", phase, error.message, config.artifactPath);
  }
}

function buildValidationResult(status, phase, issue, artifactPath, data = null) {
  return {
    status,
    phase,
    issue,
    artifactPath,
    data,
  };
}

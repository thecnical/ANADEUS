from __future__ import annotations

import json

from utils.exceptions import ParseError


def parse_native_probe(raw_output: str) -> dict:
  try:
    parsed = json.loads(raw_output.strip() or "{}")
  except json.JSONDecodeError as error:
    raise ParseError(f"Failed to parse native probe JSON output: {error}") from error

  if not isinstance(parsed, dict):
    raise ParseError("Native probe output must be a JSON object.")

  return parsed

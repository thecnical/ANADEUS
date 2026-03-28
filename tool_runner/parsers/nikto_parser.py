from __future__ import annotations

import json

from utils.exceptions import ParseError


def parse_nikto(target: str, raw_output: str) -> dict:
  try:
    payload = json.loads(raw_output)
  except json.JSONDecodeError as error:
    raise ParseError(f"Failed to parse nikto JSON output: {error}") from error

  findings = []
  notes = []

  for item in payload.get("vulnerabilities", payload.get("findings", [])):
    finding = {
      "id": item.get("id") or item.get("msgid") or "",
      "url": item.get("url") or target,
      "path": item.get("path") or "",
      "message": item.get("msg") or item.get("message") or "",
      "severity": item.get("severity") or "info",
    }
    findings.append(finding)
    if finding["message"]:
      notes.append(finding["message"])

  return {
    "findings": findings,
    "notes": list(dict.fromkeys(notes)),
    "count": len(findings),
  }

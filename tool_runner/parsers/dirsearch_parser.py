from __future__ import annotations

import json

from utils.exceptions import ParseError


def parse_dirsearch(target: str, raw_output: str) -> dict:
  try:
    payload = json.loads(raw_output)
  except json.JSONDecodeError as error:
    raise ParseError(f"Failed to parse dirsearch JSON output: {error}") from error

  results = payload.get("results", payload if isinstance(payload, list) else [])
  matches = []
  directories = []

  for entry in results:
    url = entry.get("url") or entry.get("path") or ""
    path = entry.get("path") or url
    status = entry.get("status") or entry.get("status_code")
    match = {
      "url": url,
      "path": path,
      "status": status,
      "length": entry.get("content-length") or entry.get("length"),
    }
    matches.append(match)
    if path:
      directories.append(path)

  return {
    "matches": matches,
    "directories": sorted(set(directories)),
    "count": len(matches),
  }

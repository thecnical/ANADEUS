from __future__ import annotations

import json

from utils.exceptions import ParseError


def parse_feroxbuster(target: str, raw_output: str) -> dict:
  matches = []
  directories = []

  for line in raw_output.splitlines():
    clean_line = line.strip()
    if not clean_line:
      continue

    try:
      entry = json.loads(clean_line)
    except json.JSONDecodeError as error:
      raise ParseError(f"Failed to parse feroxbuster JSON output: {error}") from error

    if entry.get("type") not in {None, "response"}:
      continue

    url = entry.get("url") or ""
    path = entry.get("path") or url
    match = {
      "url": url,
      "path": path,
      "status": entry.get("status"),
      "length": entry.get("content_length"),
    }
    matches.append(match)
    if path:
      directories.append(path)

  return {
    "matches": matches,
    "directories": sorted(set(directories)),
    "count": len(matches),
  }

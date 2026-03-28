from __future__ import annotations

import json
from urllib.parse import urlparse

from utils.exceptions import ParseError


def _normalize_match(entry: dict) -> dict:
  parsed_url = urlparse(entry.get("url", ""))
  return {
    "url": entry.get("url", ""),
    "path": parsed_url.path or "/",
    "status": entry.get("status"),
    "length": entry.get("length"),
    "words": entry.get("words"),
    "lines": entry.get("lines"),
    "position": entry.get("position"),
    "input": entry.get("input", {}),
  }


def parse_ffuf(target: str, raw_output: str) -> dict:
  matches: list[dict] = []

  for line in raw_output.splitlines():
    clean_line = line.strip()
    if not clean_line:
      continue

    try:
      entry = json.loads(clean_line)
    except json.JSONDecodeError as error:
      raise ParseError(f"Failed to parse ffuf JSON output: {error}") from error

    if isinstance(entry, dict) and isinstance(entry.get("results"), list):
      matches.extend(_normalize_match(item) for item in entry["results"])
      continue

    if isinstance(entry, dict):
      matches.append(_normalize_match(entry))

  status_codes = sorted({match["status"] for match in matches if match.get("status") is not None})
  paths = [match["path"] for match in matches if match.get("path")]

  return {
    "matches": matches,
    "count": len(matches),
    "status_codes": status_codes,
    "paths": paths,
  }

from __future__ import annotations

import json

from utils.exceptions import ParseError


def parse_httpx(target: str, raw_output: str) -> dict:
  hosts: list[dict] = []
  technologies: list[str] = []
  seen_tech: set[str] = set()

  for line in raw_output.splitlines():
    clean_line = line.strip()
    if not clean_line:
      continue

    try:
      entry = json.loads(clean_line)
    except json.JSONDecodeError as error:
      raise ParseError(f"Failed to parse httpx JSON output: {error}") from error

    record = {
      "url": entry.get("url") or entry.get("input") or target,
      "host": entry.get("host") or entry.get("input") or target,
      "status_code": entry.get("status_code"),
      "title": entry.get("title", ""),
      "webserver": entry.get("webserver", ""),
      "technologies": entry.get("tech", []) or [],
      "ip": entry.get("ip", ""),
    }
    hosts.append(record)

    for technology in record["technologies"]:
      if technology and technology not in seen_tech:
        seen_tech.add(technology)
        technologies.append(technology)

  return {
    "alive_hosts": hosts,
    "count": len(hosts),
    "technologies": technologies,
  }

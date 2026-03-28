from __future__ import annotations

import re

LINE_PATTERN = re.compile(r"^(?P<url>\S+)\s+\[(?P<status>[^\]]+)\]\s*(?P<details>.*)$")
PLUGIN_PATTERN = re.compile(r"(?P<name>[A-Za-z0-9._+-]+)\[(?P<value>[^\]]*)\]")


def parse_whatweb(target: str, raw_output: str) -> dict:
  findings: list[dict] = []
  technologies: list[str] = []
  seen_tech: set[str] = set()

  for line in raw_output.splitlines():
    clean_line = line.strip()
    if not clean_line:
      continue

    match = LINE_PATTERN.match(clean_line)
    if not match:
      findings.append({"url": target, "status": "unknown", "plugins": [], "summary": clean_line})
      continue

    plugins = []
    for plugin_match in PLUGIN_PATTERN.finditer(match.group("details")):
      plugin_name = plugin_match.group("name")
      plugin_value = plugin_match.group("value")
      plugins.append({"name": plugin_name, "value": plugin_value})
      if plugin_name not in seen_tech:
        seen_tech.add(plugin_name)
        technologies.append(plugin_name)

    findings.append(
      {
        "url": match.group("url"),
        "status": match.group("status"),
        "plugins": plugins,
        "summary": match.group("details"),
      },
    )

  return {
    "identified_technologies": technologies,
    "findings": findings,
  }

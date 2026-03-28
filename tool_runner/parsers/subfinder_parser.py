from __future__ import annotations

import json


def parse_subfinder(target: str, raw_output: str) -> dict:
  subdomains: list[str] = []
  ips: list[str] = []
  sources: list[str] = []
  seen_subdomains: set[str] = set()
  seen_ips: set[str] = set()
  seen_sources: set[str] = set()

  for line in raw_output.splitlines():
    clean_line = line.strip()
    if not clean_line:
      continue

    try:
      entry = json.loads(clean_line)
    except json.JSONDecodeError:
      if clean_line not in seen_subdomains:
        seen_subdomains.add(clean_line)
        subdomains.append(clean_line)
      continue

    host = entry.get("host") or entry.get("subdomain") or entry.get("input")
    if host and host not in seen_subdomains:
      seen_subdomains.add(host)
      subdomains.append(host)

    ip_value = entry.get("ip")
    if isinstance(ip_value, list):
      for item in ip_value:
        if item and item not in seen_ips:
          seen_ips.add(item)
          ips.append(item)
    elif isinstance(ip_value, str) and ip_value and ip_value not in seen_ips:
      seen_ips.add(ip_value)
      ips.append(ip_value)

    for source in entry.get("sources", []) or []:
      if source and source not in seen_sources:
        seen_sources.add(source)
        sources.append(source)

  return {
    "subdomains": subdomains,
    "count": len(subdomains),
    "ips": ips,
    "sources": sources,
  }

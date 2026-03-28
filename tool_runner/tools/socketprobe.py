from __future__ import annotations

import json
import sys

from parsers.native_probe_parser import parse_native_probe
from utils.security import ensure_port_spec, ensure_positive_int, reject_unknown_options

DEFAULT_TIMEOUT = 10
ALLOWED_OPTIONS = {"ports", "timeout", "top_ports"}

SCRIPT = r"""
import json
import socket
import sys
import urllib.parse

payload = json.loads(sys.argv[1])
target = payload["target"]
timeout = payload.get("timeout", 2)
ports = payload.get("ports", [80, 443])

if target.startswith(("http://", "https://")):
    hostname = urllib.parse.urlparse(target).hostname or target
else:
    hostname = target

services = {
    80: "http",
    81: "http",
    443: "https",
    3000: "http",
    8000: "http",
    8080: "http",
    8081: "http",
    8443: "https",
    8888: "http",
}

open_ports = []
service_names = []
port_details = []

for port in ports:
    try:
        with socket.create_connection((hostname, int(port)), timeout=timeout):
            open_ports.append(int(port))
            service = services.get(int(port), "tcp")
            service_names.append(service)
            port_details.append({
                "port": int(port),
                "protocol": "tcp",
                "service": service,
                "product": "",
                "version": "",
            })
    except Exception:
        continue

print(json.dumps({
    "open_ports": open_ports,
    "services": sorted(set(service_names)),
    "port_details": port_details,
}))
"""


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("socketprobe", options, ALLOWED_OPTIONS)
  timeout = ensure_positive_int("timeout", options.get("timeout", DEFAULT_TIMEOUT), minimum=1, maximum=30)

  if options.get("ports"):
    ports = [int(item) for item in _expand_ports(ensure_port_spec(options["ports"]))]
  else:
    ports = [80, 443]
    if ensure_positive_int("top_ports", options.get("top_ports", 100), minimum=1, maximum=1000) > 100:
      ports.extend([8080, 8443, 8000, 8081, 8888])

  payload = json.dumps({
    "target": target,
    "timeout": timeout,
    "ports": ports,
  })
  return [sys.executable, "-c", SCRIPT, payload]


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_native_probe(stdout)


def _expand_ports(spec: str) -> list[int]:
  ports: list[int] = []
  for chunk in spec.split(","):
    if "-" in chunk:
      start, end = chunk.split("-", 1)
      ports.extend(range(int(start), int(end) + 1))
    else:
      ports.append(int(chunk))
  return sorted(set(ports))

from __future__ import annotations

from urllib.parse import urlparse

from parsers.nmap_parser import parse_nmap
from utils.security import (
  ensure_bool,
  ensure_list_of_strings,
  ensure_port_spec,
  ensure_positive_int,
  reject_unknown_options,
)

DEFAULT_TIMEOUT = 60
ALLOWED_OPTIONS = {"ports", "service_version", "top_ports", "scripts", "timing_template"}


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("nmap", options, ALLOWED_OPTIONS)
  resolved_target = normalize_target(target)

  command = ["nmap", "-Pn", "-oX", "-"]

  if ensure_bool(options.get("service_version", True)):
    command.append("-sV")

  ports = options.get("ports")
  top_ports = options.get("top_ports")
  scripts = options.get("scripts")
  timing_template = options.get("timing_template")

  if ports is not None:
    command.extend(["-p", ensure_port_spec(ports)])
  elif top_ports is not None:
    command.extend(["--top-ports", str(ensure_positive_int("top_ports", top_ports, minimum=1, maximum=1000))])

  if scripts is not None:
    command.extend(["--script", ",".join(ensure_list_of_strings("scripts", scripts))])

  if timing_template is not None:
    timing_value = ensure_positive_int("timing_template", timing_template, minimum=0, maximum=5)
    command.append(f"-T{timing_value}")

  command.append(resolved_target)
  return command


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_nmap(target, stdout)


def normalize_target(target: str) -> str:
  value = str(target).strip()
  if value.startswith(("http://", "https://")):
    return urlparse(value).hostname or value
  return value

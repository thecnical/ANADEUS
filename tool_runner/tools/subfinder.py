from __future__ import annotations

from parsers.subfinder_parser import parse_subfinder
from utils.security import ensure_bool, ensure_positive_int, reject_unknown_options

DEFAULT_TIMEOUT = 60
ALLOWED_OPTIONS = {"all", "recursive", "max_time"}


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("subfinder", options, ALLOWED_OPTIONS)

  command = ["subfinder", "-silent", "-json", "-d", target]

  if ensure_bool(options.get("all", False)):
    command.append("-all")

  if ensure_bool(options.get("recursive", False)):
    command.append("-recursive")

  if options.get("max_time") is not None:
    command.extend(["-max-time", str(ensure_positive_int("max_time", options["max_time"], minimum=1, maximum=3600))])

  return command


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_subfinder(target, stdout)

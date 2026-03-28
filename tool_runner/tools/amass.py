from __future__ import annotations

from parsers.subfinder_parser import parse_subfinder
from utils.security import ensure_bool, reject_unknown_options

DEFAULT_TIMEOUT = 120
ALLOWED_OPTIONS = {"passive", "brute"}


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("amass", options, ALLOWED_OPTIONS)

  command = ["amass", "enum", "-d", target, "-json", "-"]

  if ensure_bool(options.get("passive", True)):
    command.append("-passive")

  if ensure_bool(options.get("brute", False)):
    command.append("-brute")

  return command


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_subfinder(target, stdout)

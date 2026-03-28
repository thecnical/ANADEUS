from __future__ import annotations

from parsers.nikto_parser import parse_nikto
from utils.security import ensure_positive_int, reject_unknown_options

DEFAULT_TIMEOUT = 180
ALLOWED_OPTIONS = {"timeout", "tuning"}


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("nikto", options, ALLOWED_OPTIONS)

  command = ["nikto", "-host", target, "-Format", "json", "-Display", "V"]

  if options.get("timeout") is not None:
    command.extend(["-timeout", str(ensure_positive_int("timeout", options["timeout"], minimum=1, maximum=600))])

  if options.get("tuning") is not None:
    command.extend(["-Tuning", str(options["tuning"])])

  return command


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_nikto(target, stdout)

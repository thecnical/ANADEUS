from __future__ import annotations

from parsers.whatweb_parser import parse_whatweb
from utils.security import ensure_bool, ensure_positive_int, reject_unknown_options

DEFAULT_TIMEOUT = 60
ALLOWED_OPTIONS = {"aggression", "follow_redirect", "verbose"}


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("whatweb", options, ALLOWED_OPTIONS)

  command = ["whatweb", "--color=never"]

  if options.get("aggression") is not None:
    command.extend(["-a", str(ensure_positive_int("aggression", options["aggression"], minimum=1, maximum=4))])

  if ensure_bool(options.get("verbose", False)):
    command.append("-v")

  if not ensure_bool(options.get("follow_redirect", True)):
    command.append("--no-redirect")

  command.append(target)
  return command


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_whatweb(target, stdout)

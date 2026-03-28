from __future__ import annotations

from parsers.httpx_parser import parse_httpx
from utils.security import ensure_bool, ensure_positive_int, reject_unknown_options

DEFAULT_TIMEOUT = 60
ALLOWED_OPTIONS = {"tech_detect", "title", "status_code", "follow_redirects", "path", "threads"}


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("httpx", options, ALLOWED_OPTIONS)

  command = ["httpx", "-silent", "-json", "-u", target]

  if ensure_bool(options.get("tech_detect", True)):
    command.append("-tech-detect")

  if ensure_bool(options.get("title", True)):
    command.append("-title")

  if ensure_bool(options.get("status_code", True)):
    command.append("-status-code")

  if ensure_bool(options.get("follow_redirects", True)):
    command.append("-fr")

  if options.get("path"):
    command.extend(["-path", str(options["path"])])

  if options.get("threads") is not None:
    command.extend(["-threads", str(ensure_positive_int("threads", options["threads"], minimum=1, maximum=500))])

  return command


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_httpx(target, stdout)

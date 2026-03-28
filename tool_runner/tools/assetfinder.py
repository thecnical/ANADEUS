from __future__ import annotations

from parsers.subfinder_parser import parse_subfinder
from utils.security import reject_unknown_options

DEFAULT_TIMEOUT = 60
ALLOWED_OPTIONS = set()


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("assetfinder", options, ALLOWED_OPTIONS)
  return ["assetfinder", "--subs-only", target]


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_subfinder(target, stdout)

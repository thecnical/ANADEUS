from __future__ import annotations

from parsers.dirsearch_parser import parse_dirsearch
from utils.security import ensure_codes_spec, ensure_positive_int, ensure_wordlist_path, reject_unknown_options

DEFAULT_TIMEOUT = 120
ALLOWED_OPTIONS = {"wordlist", "extensions", "threads", "status_codes"}


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("dirsearch", options, ALLOWED_OPTIONS)

  command = ["dirsearch", "-u", target, "--format", "json", "--quiet-mode", "--full-url"]

  if options.get("wordlist") is not None:
    command.extend(["-w", ensure_wordlist_path(options["wordlist"])])

  if options.get("extensions"):
    command.extend(["-e", str(options["extensions"])])

  if options.get("threads") is not None:
    command.extend(["-t", str(ensure_positive_int("threads", options["threads"], minimum=1, maximum=200))])

  if options.get("status_codes") is not None:
    command.extend(["-i", ensure_codes_spec(options["status_codes"])])

  return command


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_dirsearch(target, stdout)

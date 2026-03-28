from __future__ import annotations

from parsers.ffuf_parser import parse_ffuf
from utils.security import (
  ensure_bool,
  ensure_codes_spec,
  ensure_headers,
  ensure_http_method,
  ensure_positive_int,
  ensure_wordlist_path,
  reject_unknown_options,
)

DEFAULT_TIMEOUT = 60
ALLOWED_OPTIONS = {
  "url",
  "wordlist",
  "method",
  "headers",
  "match_codes",
  "filter_codes",
  "rate",
  "auto_fuzz_path",
}


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("ffuf", options, ALLOWED_OPTIONS)

  wordlist = ensure_wordlist_path(options.get("wordlist"))
  base_url = str(options.get("url") or target)

  if "FUZZ" not in base_url and ensure_bool(options.get("auto_fuzz_path", True)):
    base_url = f"{base_url.rstrip('/')}/FUZZ"

  command = ["ffuf", "-u", base_url, "-w", wordlist, "-json"]

  if options.get("method") is not None:
    command.extend(["-X", ensure_http_method(options["method"])])

  if options.get("headers") is not None:
    for header_key, header_value in ensure_headers(options["headers"]).items():
      command.extend(["-H", f"{header_key}: {header_value}"])

  if options.get("match_codes") is not None:
    command.extend(["-mc", ensure_codes_spec(options["match_codes"])])

  if options.get("filter_codes") is not None:
    command.extend(["-fc", ensure_codes_spec(options["filter_codes"])])

  if options.get("rate") is not None:
    command.extend(["-rate", str(ensure_positive_int("rate", options["rate"], minimum=1, maximum=100000))])

  return command


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_ffuf(target, stdout)

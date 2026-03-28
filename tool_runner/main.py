from __future__ import annotations

import argparse
import json
from typing import Any

from engine import run_tool


def _parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="ANADEUS tool runner engine")
  parser.add_argument("tool_name", help="Tool to execute, for example nmap or subfinder")
  parser.add_argument("target", help="Target host, domain, or URL")
  parser.add_argument("--options", default="{}", help="JSON object with tool-specific options")
  parser.add_argument("--timeout", type=int, help="Execution timeout in seconds")
  parser.add_argument("--retries", type=int, help="Retry count for retryable failures")
  parser.add_argument(
    "--fallback-tool",
    action="append",
    default=[],
    help="Fallback tool to try if the primary tool fails",
  )
  parser.add_argument("--verbose", action="store_true", help="Enable verbose execution mode")
  parser.add_argument("--debug", action="store_true", help="Enable debug execution mode")
  parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
  return parser.parse_args()


def _merge_options(args: argparse.Namespace) -> dict[str, Any]:
  try:
    parsed_options = json.loads(args.options)
  except json.JSONDecodeError as error:
    parsed_options = {"_invalid_options_json": str(error)}

  if not isinstance(parsed_options, dict):
    parsed_options = {"_invalid_options_json": "Options payload must be a JSON object."}

  if args.timeout is not None:
    parsed_options["timeout"] = args.timeout

  if args.retries is not None:
    parsed_options["retries"] = args.retries

  if args.fallback_tool:
    parsed_options["fallback_tools"] = args.fallback_tool

  if args.verbose:
    parsed_options["verbose"] = True

  if args.debug:
    parsed_options["debug"] = True

  return parsed_options


def main() -> int:
  args = _parse_args()
  options = _merge_options(args)
  result = run_tool(args.tool_name, args.target, options)
  output = json.dumps(result, indent=2 if args.pretty else None)
  print(output)
  return 0 if result.get("status") == "success" else 1


if __name__ == "__main__":
  raise SystemExit(main())

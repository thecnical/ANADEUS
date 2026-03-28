from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from utils.exceptions import ValidationError

SAFE_TARGET_PATTERN = re.compile(r"^[A-Za-z0-9._~:/?#\[\]@!&()*+,=%-]+$")
SAFE_NAME_PATTERN = re.compile(r"^[a-z0-9_]+$")
SAFE_CODE_PATTERN = re.compile(r"^[0-9,-]+$")
SAFE_PORT_PATTERN = re.compile(r"^[0-9,-]+$")
SAFE_HEADER_PATTERN = re.compile(r"^[A-Za-z0-9-]+$")
RUNNER_OPTION_KEYS = {"timeout", "retries", "fallback_tools", "verbose", "debug"}


def validate_tool_name(tool_name: str) -> str:
  normalized = str(tool_name or "").strip().lower()
  if not normalized or not SAFE_NAME_PATTERN.fullmatch(normalized):
    raise ValidationError("Tool name must contain only lowercase letters, numbers, and underscores.")
  return normalized


def validate_target(target: str) -> str:
  normalized = str(target or "").strip()

  if not normalized:
    raise ValidationError("Target cannot be empty.")

  if normalized.startswith("-"):
    raise ValidationError("Target cannot start with '-'.")

  if any(token in normalized for token in ("\x00", "\n", "\r", "\t", ";", "|", "`", "$", "<", ">", "\"")):
    raise ValidationError("Target contains unsafe characters.")

  if not SAFE_TARGET_PATTERN.fullmatch(normalized):
    raise ValidationError("Target contains unsupported characters.")

  return normalized


def ensure_timeout(value: Any, default: int) -> int:
  if value is None:
    return default
  return ensure_positive_int("timeout", value, minimum=1, maximum=3600)


def ensure_retry_count(value: Any) -> int:
  return ensure_positive_int("retries", value, minimum=0, maximum=5)


def ensure_positive_int(name: str, value: Any, minimum: int = 1, maximum: int | None = None) -> int:
  if isinstance(value, bool):
    raise ValidationError(f"{name} must be an integer.")

  try:
    normalized = int(value)
  except (TypeError, ValueError) as error:
    raise ValidationError(f"{name} must be an integer.") from error

  if normalized < minimum:
    raise ValidationError(f"{name} must be greater than or equal to {minimum}.")

  if maximum is not None and normalized > maximum:
    raise ValidationError(f"{name} must be less than or equal to {maximum}.")

  return normalized


def ensure_bool(value: Any) -> bool:
  if isinstance(value, bool):
    return value
  if value in (0, 1):
    return bool(value)
  if isinstance(value, str):
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes"}:
      return True
    if normalized in {"false", "0", "no"}:
      return False
  return bool(value)


def ensure_port_spec(value: Any) -> str:
  normalized = str(value).strip()
  if not normalized or not SAFE_PORT_PATTERN.fullmatch(normalized):
    raise ValidationError("Port specification must contain only digits, commas, and hyphens.")
  return normalized


def ensure_codes_spec(value: Any) -> str:
  normalized = str(value).strip()
  if not normalized or not SAFE_CODE_PATTERN.fullmatch(normalized):
    raise ValidationError("Status code specification must contain only digits, commas, and hyphens.")
  return normalized


def ensure_http_method(value: Any) -> str:
  method = str(value).strip().upper()
  if not method.isalpha():
    raise ValidationError("HTTP method must contain only alphabetic characters.")
  return method


def ensure_wordlist_path(value: Any) -> str:
  if value is None:
    raise ValidationError("ffuf requires a 'wordlist' option.")

  candidate = Path(str(value)).expanduser()
  if not candidate.is_file():
    raise ValidationError(f"Wordlist file was not found: {candidate}")

  return str(candidate)


def ensure_headers(value: Any) -> dict[str, str]:
  if not isinstance(value, dict):
    raise ValidationError("headers must be a JSON object of key/value pairs.")

  sanitized: dict[str, str] = {}
  for key, header_value in value.items():
    header_key = str(key).strip()
    header_text = str(header_value).strip()

    if not SAFE_HEADER_PATTERN.fullmatch(header_key):
      raise ValidationError(f"Invalid header name: {header_key}")

    if any(token in header_text for token in ("\x00", "\n", "\r")):
      raise ValidationError(f"Invalid header value for {header_key}")

    sanitized[header_key] = header_text

  return sanitized


def ensure_list_of_strings(name: str, value: Any) -> list[str]:
  if isinstance(value, str):
    return [value]

  if not isinstance(value, list) or not value:
    raise ValidationError(f"{name} must be a non-empty list of strings.")

  result: list[str] = []
  for item in value:
    text = str(item).strip()
    if not text:
      raise ValidationError(f"{name} cannot contain empty values.")
    result.append(text)

  return result


def reject_unknown_options(tool_name: str, options: dict[str, Any], allowed_keys: set[str]) -> None:
  unknown_keys = sorted(set(options.keys()) - allowed_keys)
  if unknown_keys:
    raise ValidationError(f"Unsupported options for {tool_name}: {', '.join(unknown_keys)}.")


def split_runtime_options(options: dict[str, Any] | None) -> tuple[dict[str, Any], dict[str, Any]]:
  if options is None:
    return {}, {}

  if not isinstance(options, dict):
    raise ValidationError("options must be a JSON object.")

  runtime_options: dict[str, Any] = {}
  tool_options: dict[str, Any] = {}

  for key, value in options.items():
    if key == "_invalid_options_json":
      raise ValidationError(str(value))

    if key in RUNNER_OPTION_KEYS:
      runtime_options[key] = value
    else:
      tool_options[key] = value

  fallback_tools = runtime_options.get("fallback_tools", [])
  if fallback_tools is None:
    runtime_options["fallback_tools"] = []
  elif isinstance(fallback_tools, list):
    runtime_options["fallback_tools"] = [validate_tool_name(item) for item in fallback_tools]
  else:
    raise ValidationError("fallback_tools must be a list of tool names.")

  if "verbose" in runtime_options:
    runtime_options["verbose"] = ensure_bool(runtime_options["verbose"])

  if "debug" in runtime_options:
    runtime_options["debug"] = ensure_bool(runtime_options["debug"])

  return runtime_options, tool_options

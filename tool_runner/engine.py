from __future__ import annotations

import time
from typing import Any

from tools.loader import load_tool_module
from utils.exceptions import (
  CommandExecutionTimeout,
  ParseError,
  ToolBinaryNotFound,
  ToolNotSupportedError,
  ValidationError,
)
from utils.logging_utils import get_logger
from utils.process_utils import execute_command
from utils.security import (
  ensure_retry_count,
  ensure_timeout,
  split_runtime_options,
  validate_target,
  validate_tool_name,
)

RETRYABLE_ERROR_TYPES = {"command_failure", "empty_output", "parse_error", "timeout"}


def _build_result(
  tool: str,
  target: str,
  status: str,
  data: dict[str, Any] | None = None,
  raw_output: str = "",
  execution_time: float = 0.0,
  error_type: str | None = None,
  message: str | None = None,
) -> dict[str, Any]:
  result: dict[str, Any] = {
    "tool": tool,
    "target": target,
    "status": status,
    "data": data or {},
    "raw_output": raw_output,
    "execution_time": round(execution_time, 4),
  }

  if error_type:
    result["error_type"] = error_type

  if message:
    result["message"] = message

  return result


class ToolRunnerEngine:
  def __init__(self) -> None:
    self.logger = get_logger()

  def run_tool(self, tool_name: str, target: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
      sanitized_tool = validate_tool_name(tool_name)
      sanitized_target = validate_target(target)
      runtime_options, tool_options = split_runtime_options(options)
    except ValidationError as error:
      return _build_result(
        tool=str(tool_name),
        target=str(target),
        status="error",
        error_type="validation_error",
        message=str(error),
      )

    retries = ensure_retry_count(runtime_options.get("retries", 0))
    fallback_tools = runtime_options.get("fallback_tools", [])
    execution_plan = [sanitized_tool, *fallback_tools]

    final_result: dict[str, Any] | None = None

    for planned_tool in execution_plan:
      final_result = self._execute_with_retries(
        tool_name=planned_tool,
        target=sanitized_target,
        tool_options=tool_options,
        runtime_options=runtime_options,
        retries=retries,
      )
      if final_result["status"] == "success":
        return final_result

    return final_result or _build_result(
      tool=sanitized_tool,
      target=sanitized_target,
      status="error",
      error_type="internal_error",
      message="Tool runner terminated without producing a result.",
    )

  def _execute_with_retries(
    self,
    tool_name: str,
    target: str,
    tool_options: dict[str, Any],
    runtime_options: dict[str, Any],
    retries: int,
  ) -> dict[str, Any]:
    started_at = time.perf_counter()
    last_result: dict[str, Any] | None = None

    for attempt in range(retries + 1):
      result = self._execute_once(tool_name, target, tool_options, runtime_options, started_at)
      last_result = result

      if result["status"] == "success":
        self._log_execution(tool_name, target, result)
        return result

      if result.get("error_type") not in RETRYABLE_ERROR_TYPES or attempt >= retries:
        self._log_execution(tool_name, target, result)
        return result

    self._log_execution(tool_name, target, last_result or {})
    return last_result or _build_result(
      tool=tool_name,
      target=target,
      status="error",
      error_type="internal_error",
      message="Retry loop ended unexpectedly.",
      execution_time=time.perf_counter() - started_at,
    )

  def _execute_once(
    self,
    tool_name: str,
    target: str,
    tool_options: dict[str, Any],
    runtime_options: dict[str, Any],
    started_at: float,
  ) -> dict[str, Any]:
    try:
      tool_module = load_tool_module(tool_name)
      timeout = ensure_timeout(
        runtime_options.get("timeout", getattr(tool_module, "DEFAULT_TIMEOUT", 60)),
        getattr(tool_module, "DEFAULT_TIMEOUT", 60),
      )
      command = tool_module.build_command(target, tool_options)
      command_result = execute_command(command, timeout=timeout)
      raw_output = self._combine_output(command_result.stdout, command_result.stderr)

      if command_result.exit_code != 0:
        error_type, message = self._classify_command_failure(tool_name, raw_output, command_result.exit_code)
        return _build_result(
          tool=tool_name,
          target=target,
          status="error",
          raw_output=raw_output,
          execution_time=time.perf_counter() - started_at,
          error_type=error_type,
          message=message,
        )

      if not command_result.stdout.strip():
        return _build_result(
          tool=tool_name,
          target=target,
          status="error",
          raw_output=raw_output,
          execution_time=time.perf_counter() - started_at,
          error_type="empty_output",
          message=f"{tool_name} returned no stdout output.",
        )

      data = tool_module.parse_output(
        target=target,
        stdout=command_result.stdout,
        stderr=command_result.stderr,
        exit_code=command_result.exit_code,
        options=tool_options,
      )

      return _build_result(
        tool=tool_name,
        target=target,
        status="success",
        data=data,
        raw_output=raw_output,
        execution_time=time.perf_counter() - started_at,
      )
    except ToolNotSupportedError as error:
      return _build_result(
        tool=tool_name,
        target=target,
        status="error",
        execution_time=time.perf_counter() - started_at,
        error_type="unsupported_tool",
        message=str(error),
      )
    except ToolBinaryNotFound as error:
      return _build_result(
        tool=tool_name,
        target=target,
        status="error",
        execution_time=time.perf_counter() - started_at,
        error_type="tool_not_found",
        message=str(error),
      )
    except CommandExecutionTimeout as error:
      return _build_result(
        tool=tool_name,
        target=target,
        status="error",
        raw_output=self._combine_output(error.stdout, error.stderr),
        execution_time=time.perf_counter() - started_at,
        error_type="timeout",
        message=str(error),
      )
    except ValidationError as error:
      return _build_result(
        tool=tool_name,
        target=target,
        status="error",
        execution_time=time.perf_counter() - started_at,
        error_type="validation_error",
        message=str(error),
      )
    except ParseError as error:
      return _build_result(
        tool=tool_name,
        target=target,
        status="error",
        execution_time=time.perf_counter() - started_at,
        error_type="parse_error",
        message=str(error),
      )
    except Exception as error:  # pragma: no cover
      return _build_result(
        tool=tool_name,
        target=target,
        status="error",
        execution_time=time.perf_counter() - started_at,
        error_type="internal_error",
        message=f"Unhandled tool runner error: {error}",
      )

  @staticmethod
  def _combine_output(stdout: str, stderr: str) -> str:
    clean_stdout = stdout.strip()
    clean_stderr = stderr.strip()

    if clean_stdout and clean_stderr:
      return f"{clean_stdout}\n--- stderr ---\n{clean_stderr}"

    return clean_stdout or clean_stderr

  @staticmethod
  def _classify_command_failure(tool_name: str, raw_output: str, exit_code: int) -> tuple[str, str]:
    normalized_output = raw_output.lower()

    if tool_name == "httpx" and "usage: httpx" in normalized_output and "no such option" in normalized_output:
      return (
        "tool_binary_mismatch",
        "The 'httpx' binary in PATH does not match the expected ProjectDiscovery httpx CLI.",
      )

    return (
      "command_failure",
      f"{tool_name} exited with code {exit_code}.",
    )

  def _log_execution(self, tool_name: str, target: str, result: dict[str, Any]) -> None:
    self.logger.info(
      "tool=%s target=%s status=%s execution_time=%s",
      tool_name,
      target,
      result.get("status", "unknown"),
      result.get("execution_time", 0.0),
    )


def run_tool(tool_name: str, target: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
  engine = ToolRunnerEngine()
  return engine.run_tool(tool_name=tool_name, target=target, options=options or {})

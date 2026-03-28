from __future__ import annotations

import subprocess
from dataclasses import dataclass

from utils.exceptions import CommandExecutionTimeout, ToolBinaryNotFound


@dataclass
class CommandExecutionResult:
  command: list[str]
  stdout: str
  stderr: str
  exit_code: int


def execute_command(command: list[str], timeout: int) -> CommandExecutionResult:
  try:
    process = subprocess.Popen(
      command,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      text=True,
      encoding="utf-8",
      errors="replace",
      shell=False,
    )
  except FileNotFoundError as error:
    raise ToolBinaryNotFound(command[0]) from error

  try:
    stdout, stderr = process.communicate(timeout=timeout)
  except subprocess.TimeoutExpired as error:
    process.kill()
    stdout, stderr = process.communicate()
    raise CommandExecutionTimeout(command[0], timeout, stdout=stdout or "", stderr=stderr or "") from error

  return CommandExecutionResult(
    command=command,
    stdout=stdout or "",
    stderr=stderr or "",
    exit_code=process.returncode,
  )

from __future__ import annotations


class ToolRunnerError(Exception):
  pass


class ValidationError(ToolRunnerError):
  pass


class ToolNotSupportedError(ToolRunnerError):
  pass


class ToolBinaryNotFound(ToolRunnerError):
  def __init__(self, tool_name: str):
    super().__init__(f"Tool binary '{tool_name}' was not found in PATH.")
    self.tool_name = tool_name


class CommandExecutionTimeout(ToolRunnerError):
  def __init__(self, tool_name: str, timeout: int, stdout: str = "", stderr: str = ""):
    super().__init__(f"Tool '{tool_name}' exceeded timeout of {timeout} seconds.")
    self.tool_name = tool_name
    self.timeout = timeout
    self.stdout = stdout
    self.stderr = stderr


class ParseError(ToolRunnerError):
  pass

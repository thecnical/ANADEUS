from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
  sys.path.insert(0, str(BASE_DIR))

from engine import run_tool


class FakeSuccessTool:
  DEFAULT_TIMEOUT = 5

  @staticmethod
  def build_command(target, options):
    return [sys.executable, "-c", "print('hello from tool runner')"]

  @staticmethod
  def parse_output(target, stdout, stderr, exit_code, options):
    return {"message": stdout.strip()}


class FakeTimeoutTool:
  DEFAULT_TIMEOUT = 1

  @staticmethod
  def build_command(target, options):
    return [sys.executable, "-c", "import time; time.sleep(2)"]

  @staticmethod
  def parse_output(target, stdout, stderr, exit_code, options):
    return {}


class ToolRunnerEngineTests(unittest.TestCase):
  @patch("engine.load_tool_module", return_value=FakeSuccessTool)
  def test_run_tool_success_contract(self, _mock_loader):
    result = run_tool("nmap", "example.com", {"timeout": 5})

    self.assertEqual(result["status"], "success")
    self.assertEqual(result["tool"], "nmap")
    self.assertEqual(result["target"], "example.com")
    self.assertIn("message", result["data"])
    self.assertGreaterEqual(result["execution_time"], 0.0)

  @patch("engine.load_tool_module", return_value=FakeTimeoutTool)
  def test_run_tool_timeout_error_contract(self, _mock_loader):
    result = run_tool("nmap", "example.com", {"timeout": 1})

    self.assertEqual(result["status"], "error")
    self.assertEqual(result["error_type"], "timeout")
    self.assertIn("execution_time", result)

  def test_run_tool_rejects_unsupported_tool(self):
    result = run_tool("unknown", "example.com", {})

    self.assertEqual(result["status"], "error")
    self.assertEqual(result["error_type"], "unsupported_tool")

  def test_run_tool_rejects_unsafe_target(self):
    result = run_tool("nmap", "example.com;rm -rf /", {})

    self.assertEqual(result["status"], "error")
    self.assertEqual(result["error_type"], "validation_error")

  def test_httpx_binary_mismatch_is_reported_clearly(self):
    from engine import ToolRunnerEngine

    error_type, message = ToolRunnerEngine._classify_command_failure(
      "httpx",
      "Usage: httpx [OPTIONS] URL\n\nError: No such option: -s",
      2,
    )

    self.assertEqual(error_type, "tool_binary_mismatch")
    self.assertIn("ProjectDiscovery", message)


if __name__ == "__main__":
  unittest.main()

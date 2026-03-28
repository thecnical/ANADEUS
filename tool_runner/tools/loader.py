from __future__ import annotations

import importlib

from utils.exceptions import ToolNotSupportedError
from utils.security import validate_tool_name

SUPPORTED_TOOLS = {
  "amass",
  "assetfinder",
  "dirsearch",
  "feroxbuster",
  "ffuf",
  "httpx",
  "nikto",
  "nmap",
  "routeprobe",
  "socketprobe",
  "subfinder",
  "webprobe",
  "whatweb",
}


def load_tool_module(tool_name: str):
  normalized = validate_tool_name(tool_name)
  if normalized not in SUPPORTED_TOOLS:
    raise ToolNotSupportedError(
      f"Unsupported tool '{tool_name}'. Supported tools: {', '.join(sorted(SUPPORTED_TOOLS))}.",
    )

  return importlib.import_module(f"tools.{normalized}")

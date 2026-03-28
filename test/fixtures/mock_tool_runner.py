import json
import sys

tool = sys.argv[1]
target = sys.argv[2]

if tool == "subfinder":
  print(json.dumps({
    "tool": tool,
    "target": target,
    "status": "error",
    "data": {},
    "raw_output": "",
    "execution_time": 0.1,
    "error_type": "tool_not_found",
    "message": "subfinder unavailable"
  }))
elif tool == "nmap":
  print(json.dumps({
    "tool": tool,
    "target": target,
    "status": "success",
    "data": {
      "open_ports": [80, 443],
      "services": ["http", "https"]
    },
    "raw_output": "mock-nmap-output",
    "execution_time": 0.2
  }))
else:
  print(json.dumps({
    "tool": tool,
    "target": target,
    "status": "error",
    "data": {},
    "raw_output": "",
    "execution_time": 0.0,
    "error_type": "unsupported_tool",
    "message": f"unexpected tool {tool}"
  }))

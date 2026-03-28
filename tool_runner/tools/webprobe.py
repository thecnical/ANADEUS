from __future__ import annotations

import json
import sys

from parsers.native_probe_parser import parse_native_probe
from utils.security import ensure_positive_int, reject_unknown_options

DEFAULT_TIMEOUT = 8
ALLOWED_OPTIONS = {"timeout"}

SCRIPT = r"""
import json
import re
import socket
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

payload = json.loads(sys.argv[1])
target = payload["target"]
timeout = payload.get("timeout", 10)
context = ssl._create_unverified_context()
headers = {"User-Agent": "ANADEUS/1.0"}
errors = []

def build_candidates(value):
    if value.startswith(("http://", "https://")):
        return [value.rstrip("/")]
    return [f"https://{value}".rstrip("/"), f"http://{value}".rstrip("/")]

def extract_title(body):
    match = re.search(r"<title[^>]*>(.*?)</title>", body, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return re.sub(r"\s+", " ", match.group(1)).strip()

def extract_technologies(server, powered_by):
    raw = []
    for value in (server, powered_by):
        for item in re.split(r"[/,; ]+", value or ""):
            clean = item.strip()
            if clean:
                raw.append(clean)
    deduped = []
    seen = set()
    for item in raw:
        lowered = item.lower()
        if lowered not in seen:
            seen.add(lowered)
            deduped.append(item)
    return deduped

for candidate in build_candidates(target):
    candidate_host = urllib.parse.urlparse(candidate).hostname or target
    try:
        socket.gethostbyname(candidate_host)
    except Exception as error:
        errors.append(str(error))
        continue
    request = urllib.request.Request(candidate, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            body = response.read(4096).decode("utf-8", errors="replace")
            final_url = response.geturl()
            parsed = urllib.parse.urlparse(final_url)
            host = parsed.hostname or urllib.parse.urlparse(candidate).hostname or target
            server = response.headers.get("Server", "")
            powered_by = response.headers.get("X-Powered-By", "")
            result = {
                "alive_hosts": [{
                    "url": final_url.rstrip("/"),
                    "host": host,
                    "status_code": getattr(response, "status", None),
                    "title": extract_title(body),
                    "webserver": server,
                    "technologies": extract_technologies(server, powered_by),
                    "ip": socket.gethostbyname(host) if host else "",
                }],
                "count": 1,
            }
            result["technologies"] = result["alive_hosts"][0]["technologies"]
            print(json.dumps(result))
            sys.exit(0)
    except urllib.error.HTTPError as error:
        body = error.read(4096).decode("utf-8", errors="replace")
        final_url = error.geturl()
        parsed = urllib.parse.urlparse(final_url)
        host = parsed.hostname or urllib.parse.urlparse(candidate).hostname or target
        server = error.headers.get("Server", "")
        powered_by = error.headers.get("X-Powered-By", "")
        result = {
            "alive_hosts": [{
                "url": final_url.rstrip("/"),
                "host": host,
                "status_code": error.code,
                "title": extract_title(body),
                "webserver": server,
                "technologies": extract_technologies(server, powered_by),
                "ip": socket.gethostbyname(host) if host else "",
            }],
            "count": 1,
        }
        result["technologies"] = result["alive_hosts"][0]["technologies"]
        print(json.dumps(result))
        sys.exit(0)
    except Exception as error:
        errors.append(str(error))

print(json.dumps({
    "alive_hosts": [],
    "count": 0,
    "technologies": [],
    "errors": errors,
}))
sys.exit(1)
"""


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("webprobe", options, ALLOWED_OPTIONS)
  timeout = ensure_positive_int("timeout", options.get("timeout", DEFAULT_TIMEOUT), minimum=1, maximum=120)
  payload = json.dumps({
    "target": target,
    "timeout": timeout,
  })
  return [sys.executable, "-c", SCRIPT, payload]


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_native_probe(stdout)

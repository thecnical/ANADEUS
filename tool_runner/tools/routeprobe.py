from __future__ import annotations

import json
import sys

from parsers.native_probe_parser import parse_native_probe
from utils.security import ensure_positive_int, reject_unknown_options

DEFAULT_TIMEOUT = 6
ALLOWED_OPTIONS = {"timeout", "paths"}

SCRIPT = r"""
import json
import socket
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

payload = json.loads(sys.argv[1])
target = payload["target"]
timeout = payload.get("timeout", 10)
paths = payload.get("paths", ["/", "/robots.txt", "/login", "/admin", "/api", "/api/v1", "/graphql"])
allowed_codes = {200, 204, 301, 302, 307, 308, 401, 403}
context = ssl._create_unverified_context()
headers = {"User-Agent": "ANADEUS/1.0"}

def build_candidates(value):
    if value.startswith(("http://", "https://")):
        return [value.rstrip("/")]
    return [f"https://{value}".rstrip("/"), f"http://{value}".rstrip("/")]

def make_match(url, status, body):
    path = urllib.parse.urlparse(url).path or "/"
    words = len(body.split())
    lines = len(body.splitlines()) or (1 if body else 0)
    return {
        "url": url,
        "path": path,
        "status": status,
        "length": len(body),
        "words": words,
        "lines": lines,
        "position": 0,
        "input": {},
    }

matches = []
for base in build_candidates(target):
    candidate_host = urllib.parse.urlparse(base).hostname or target
    try:
        socket.gethostbyname(candidate_host)
    except Exception:
        continue
    for item in paths:
        url = base if item == "/" else urllib.parse.urljoin(f"{base}/", item.lstrip("/"))
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
                body = response.read(4096).decode("utf-8", errors="replace")
                status = getattr(response, "status", 200)
                if status in allowed_codes:
                    matches.append(make_match(response.geturl(), status, body))
        except urllib.error.HTTPError as error:
            body = error.read(4096).decode("utf-8", errors="replace")
            if error.code in allowed_codes:
                matches.append(make_match(error.geturl(), error.code, body))
        except Exception:
            continue
    if matches:
        break

status_codes = sorted({item["status"] for item in matches})
paths_found = [item["path"] for item in matches]
print(json.dumps({
    "matches": matches,
    "count": len(matches),
    "status_codes": status_codes,
    "paths": paths_found,
    "directories": paths_found,
}))
"""


def build_command(target: str, options: dict) -> list[str]:
  reject_unknown_options("routeprobe", options, ALLOWED_OPTIONS)
  timeout = ensure_positive_int("timeout", options.get("timeout", DEFAULT_TIMEOUT), minimum=1, maximum=60)
  paths = options.get("paths") or ["/", "/robots.txt", "/login", "/admin", "/api", "/api/v1", "/graphql"]
  payload = json.dumps({
    "target": target,
    "timeout": timeout,
    "paths": paths,
  })
  return [sys.executable, "-c", SCRIPT, payload]


def parse_output(target: str, stdout: str, stderr: str, exit_code: int, options: dict) -> dict:
  return parse_native_probe(stdout)

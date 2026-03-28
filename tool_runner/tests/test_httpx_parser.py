from __future__ import annotations

import sys
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
  sys.path.insert(0, str(BASE_DIR))

from parsers.httpx_parser import parse_httpx

HTTPX_LINES = """
{"input":"api.example.com","host":"api.example.com","url":"https://api.example.com","status_code":200,"title":"API","webserver":"nginx","tech":["nginx","react"],"ip":"1.1.1.1"}
{"input":"dev.example.com","host":"dev.example.com","url":"https://dev.example.com","status_code":302,"title":"Dev","webserver":"cloudflare","tech":["next.js"],"ip":"1.1.1.2"}
"""


class HttpxParserTests(unittest.TestCase):
  def test_parse_httpx(self):
    result = parse_httpx("example.com", HTTPX_LINES)

    self.assertEqual(result["count"], 2)
    self.assertIn("nginx", result["technologies"])
    self.assertEqual(result["alive_hosts"][0]["url"], "https://api.example.com")


if __name__ == "__main__":
  unittest.main()

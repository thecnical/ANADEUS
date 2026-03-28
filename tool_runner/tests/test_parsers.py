from __future__ import annotations

import sys
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
  sys.path.insert(0, str(BASE_DIR))

from parsers.dirsearch_parser import parse_dirsearch
from parsers.ffuf_parser import parse_ffuf
from parsers.feroxbuster_parser import parse_feroxbuster
from parsers.nikto_parser import parse_nikto
from parsers.nmap_parser import parse_nmap
from parsers.subfinder_parser import parse_subfinder

NMAP_XML = """<?xml version="1.0"?>
<nmaprun>
  <host>
    <status state="up" />
    <address addr="example.com" addrtype="ipv4" />
    <ports>
      <port protocol="tcp" portid="80">
        <state state="open" />
        <service name="http" product="nginx" version="1.25" />
      </port>
      <port protocol="tcp" portid="443">
        <state state="open" />
        <service name="https" product="nginx" version="1.25" />
      </port>
    </ports>
  </host>
</nmaprun>
"""

SUBFINDER_LINES = """
{"host":"api.example.com","ip":"10.10.10.10","sources":["crtsh"]}
{"host":"dev.example.com","ip":"10.10.10.11","sources":["securitytrails"]}
"""

FFUF_LINES = """
{"input":{"FUZZ":"admin"},"url":"https://example.com/admin","status":200,"length":1234,"words":111,"lines":10,"position":1}
{"input":{"FUZZ":"login"},"url":"https://example.com/login","status":302,"length":432,"words":52,"lines":6,"position":2}
"""

DIRSEARCH_JSON = """
{"results":[
  {"url":"https://example.com/admin","path":"/admin","status":200,"content-length":123},
  {"url":"https://example.com/api","path":"/api","status":403,"content-length":45}
]}
"""

FEROX_LINES = """
{"type":"response","url":"https://example.com/admin","path":"/admin","status":200,"content_length":123}
{"type":"response","url":"https://example.com/api","path":"/api","status":403,"content_length":45}
"""

NIKTO_JSON = """
{"findings":[
  {"id":"OSVDB-1","url":"https://example.com","path":"/","message":"Outdated server banner","severity":"medium"}
]}
"""


class ParserTests(unittest.TestCase):
  def test_parse_nmap(self):
    result = parse_nmap("example.com", NMAP_XML)

    self.assertEqual(result["open_ports"], [80, 443])
    self.assertIn("http", result["services"])
    self.assertEqual(len(result["port_details"]), 2)

  def test_parse_subfinder(self):
    result = parse_subfinder("example.com", SUBFINDER_LINES)

    self.assertEqual(result["count"], 2)
    self.assertIn("api.example.com", result["subdomains"])

  def test_parse_ffuf(self):
    result = parse_ffuf("example.com", FFUF_LINES)

    self.assertEqual(result["count"], 2)
    self.assertEqual(result["status_codes"], [200, 302])
    self.assertIn("/admin", result["paths"])

  def test_parse_dirsearch(self):
    result = parse_dirsearch("example.com", DIRSEARCH_JSON)

    self.assertEqual(result["count"], 2)
    self.assertIn("/admin", result["directories"])

  def test_parse_feroxbuster(self):
    result = parse_feroxbuster("example.com", FEROX_LINES)

    self.assertEqual(result["count"], 2)
    self.assertIn("/api", result["directories"])

  def test_parse_nikto(self):
    result = parse_nikto("example.com", NIKTO_JSON)

    self.assertEqual(result["count"], 1)
    self.assertIn("Outdated server banner", result["notes"])


if __name__ == "__main__":
  unittest.main()

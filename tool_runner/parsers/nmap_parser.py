from __future__ import annotations

import xml.etree.ElementTree as ET

from utils.exceptions import ParseError


def parse_nmap(target: str, raw_output: str) -> dict:
  try:
    root = ET.fromstring(raw_output)
  except ET.ParseError as error:
    raise ParseError(f"Failed to parse nmap XML output: {error}") from error

  open_ports: list[int] = []
  services: list[str] = []
  service_set: set[str] = set()
  port_details: list[dict] = []
  hosts: list[dict] = []

  for host in root.findall("host"):
    host_record = {
      "addresses": [node.get("addr", "") for node in host.findall("address") if node.get("addr")],
      "status": host.find("status").get("state", "unknown") if host.find("status") is not None else "unknown",
      "ports": [],
    }

    for port in host.findall("./ports/port"):
      state_node = port.find("state")
      if state_node is None or state_node.get("state") != "open":
        continue

      service_node = port.find("service")
      service_name = service_node.get("name", "") if service_node is not None else ""
      detail = {
        "port": int(port.get("portid", "0")),
        "protocol": port.get("protocol", ""),
        "service": service_name,
        "product": service_node.get("product", "") if service_node is not None else "",
        "version": service_node.get("version", "") if service_node is not None else "",
      }

      open_ports.append(detail["port"])
      host_record["ports"].append(detail)
      port_details.append(detail)

      if service_name and service_name not in service_set:
        service_set.add(service_name)
        services.append(service_name)

    hosts.append(host_record)

  return {
    "open_ports": sorted(set(open_ports)),
    "services": services,
    "port_details": port_details,
    "hosts": hosts,
  }

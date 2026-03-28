export const PHASE_TASK_TEMPLATES = {
  recon: [
    {
      name: "subdomain_enum",
      tools: ["subfinder"],
      continueOnFailure: true,
    },
    {
      name: "tech_fingerprint",
      tools: ["whatweb"],
      continueOnFailure: true,
    },
    {
      name: "port_scan",
      tools: ["nmap"],
      continueOnFailure: true,
    },
  ],
  scan: [
    {
      name: "service_validation",
      tools: [
        {
          name: "nmap",
          options: {
            service_version: true,
            top_ports: 1000,
          },
        },
      ],
      continueOnFailure: true,
    },
    {
      name: "content_discovery",
      tools: [
        {
          name: "ffuf",
          options: {
            wordlist: "/usr/share/wordlists/dirb/common.txt",
          },
        },
      ],
      continueOnFailure: true,
    },
  ],
};

export const AGENT_PHASE_MAP = {
  auto: "auto",
  recon: "recon",
  scan: "scan",
  scanner: "scan",
  analysis: "analysis",
  exploit: "exploit",
  report: "report",
};

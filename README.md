<p align="center">
  <img src="./docs/assets/banner.png" alt="ANADEUS – AI Cybersecurity Brain" width="100%" />
</p>

<h1 align="center">ANADEUS</h1>

<p align="center">
  <strong>AI-Powered Cybersecurity &amp; Bug Bounty Automation Platform</strong>
</p>

<p align="center">
  <em>Autonomous multi-agent pipeline &mdash; Recon → Scan → Analysis → Exploit → Report</em>
</p>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick_Start-00C7B7?style=for-the-badge&logo=lightning&logoColor=white" alt="Quick Start" /></a>
  <a href="#-usage"><img src="https://img.shields.io/badge/Usage-0078D4?style=for-the-badge&logo=terminal&logoColor=white" alt="Usage" /></a>
  <a href="#-api-configuration"><img src="https://img.shields.io/badge/API_Setup-FF6B6B?style=for-the-badge&logo=key&logoColor=white" alt="API Setup" /></a>
  <a href="https://buymeacoffee.com/chandanpandit"><img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-≥20-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Platform-Kali_Linux-557C94?logo=kalilinux&logoColor=white" alt="Kali Linux" />
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/Status-Production-brightgreen" alt="Status" />
</p>

---

```
     ╔═══════════════════════════════════════════════════════════════╗
     ║                                                               ║
     ║     █████╗ ███╗   ██╗ █████╗ ██████╗ ███████╗██╗   ██╗███████╗║
     ║    ██╔══██╗████╗  ██║██╔══██╗██╔══██╗██╔════╝██║   ██║██╔════╝║
     ║    ███████║██╔██╗ ██║███████║██║  ██║█████╗  ██║   ██║███████╗║
     ║    ██╔══██║██║╚██╗██║██╔══██║██║  ██║██╔══╝  ██║   ██║╚════██║║
     ║    ██║  ██║██║ ╚████║██║  ██║██████╔╝███████╗╚██████╔╝███████║║
     ║    ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝║
     ║                                                               ║
     ║              ◈  A I   C Y B E R S E C U R I T Y  ◈           ║
     ║                       B R A I N                               ║
     ║                                                               ║
     ║           Built by Chandan Pandey  ·  MIT License             ║
     ║                                                               ║
     ╚═══════════════════════════════════════════════════════════════╝
```

---

## 📋 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [API Configuration](#-api-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Dashboard](#-dashboard)
- [Safe GitHub Push Guide](#-safe-github-push-guide)
- [Contributing](#-contributing)
- [Security Disclaimer](#-security-disclaimer)
- [Support the Project](#-support-the-project)
- [License](#-license)

---

## 🧠 About

**ANADEUS** is an AI-powered cybersecurity orchestration platform that automates the entire ethical hacking and bug bounty workflow. It coordinates multiple specialized agents — from reconnaissance to final reporting — through an intelligent decision engine that determines what to run, when to stop, and how to adapt.

Built for security researchers, penetration testers, and bug bounty hunters, ANADEUS transforms hours of manual toolchain management into a single autonomous pipeline.

**Keywords:** AI cybersecurity, bug bounty automation, Kali Linux tools, penetration testing AI, ethical hacking automation, automated vulnerability scanning, security orchestration platform

---

## ✨ Features

| Category | Capability |
|---|---|
| **Multi-Agent System** | Five autonomous agents — Recon, Scanner, Analysis, Exploit, and Report — each with specialized logic and fallback chains |
| **AI Decision Engine** | Intelligent phase orchestration with Bytez (primary) and OpenRouter (fallback) LLM providers for context-aware decisions |
| **Automated Pipeline** | Full `Recon → Scan → Analysis → Exploit → PoC → Impact → Report` workflow in a single command |
| **14+ Tool Integrations** | Subfinder, Amass, httpx, Nmap, ffuf, Nikto, WhatWeb, dirsearch, Feroxbuster, and custom probes (WebProbe, SocketProbe, RouteProbe) |
| **Smart Fallback Chains** | Every phase has primary and backup tools — if `nmap` fails, `socketprobe` takes over automatically |
| **Safe Exploit Validation** | SQL injection, XSS, IDOR, CSRF, and Auth Bypass validation using harmless probes only — zero destructive payloads |
| **Structured Reporting** | Generates `impact.json` + `final_report.md` + `poc.md` with evidence, confidence scores, and remediation steps |
| **CLI + Dashboard** | Terminal-first interface with Commander.js, plus a real-time web dashboard powered by Express and Socket.IO |
| **Deterministic State** | Atomic JSON writes, phase state managed through a single source of truth (`meta.json`), hard state resets |
| **Strict Input Validation** | Command injection prevention with early CLI-level target sanitization before any tool execution |
| **Tool Option Sanitization** | Per-tool schemas prevent incompatible options from propagating through fallback chains |
| **Performance Scheduler** | Concurrent batch execution with configurable parallelism and target prioritization |

---

## 🏗️ Architecture

ANADEUS uses a layered architecture with clear separation of concerns:

```
┌──────────────────────────────────────────────────────┐
│                    CLI / Dashboard                     │
├──────────────────────────────────────────────────────┤
│               Input Router & Validation               │
├──────────────────────────────────────────────────────┤
│                  AI Decision Engine                    │
│          (Bytez Primary → OpenRouter Fallback)         │
├──────────────────────────────────────────────────────┤
│                   Orchestrator                         │
│         Phase Manager  ·  Task Engine  ·  Logger       │
├─────────┬─────────┬──────────┬──────────┬────────────┤
│  Recon  │ Scanner │ Analysis │ Exploit  │   Report    │
│  Agent  │  Agent  │  Agent   │  Agent   │   Agent     │
├─────────┴─────────┴──────────┴──────────┴────────────┤
│               Tool Runner (Python)                     │
│  subfinder · nmap · ffuf · nikto · httpx · whatweb     │
│  amass · dirsearch · feroxbuster · webprobe · ...      │
├──────────────────────────────────────────────────────┤
│           Workspace (per-target state + artifacts)     │
└──────────────────────────────────────────────────────┘
```

For the full architecture document, see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Minimum Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 20.x | Core runtime |
| **Python** | ≥ 3.9 | Tool runner backend |
| **Kali Linux** | 2024.x+ | Security tool ecosystem |

### Step 1 — Clone the Repository

```bash
git clone https://github.com/yourusername/anadeus.git
cd anadeus
```

### Step 2 — Install Node.js Dependencies

```bash
npm install
```

### Step 3 — Install Python Dependencies

```bash
pip install -r requirements.txt
```

> **Note:** Most security tools (Nmap, Subfinder, ffuf, Nikto, etc.) come pre-installed on Kali Linux. If you're on another distribution, install them via your package manager.

### Step 4 — Configure API Keys

```bash
cp .env.example .env
# Edit .env with your actual keys (see API Configuration below)
```

### Step 5 — Verify Installation

```bash
npm run banner
```

You should see the ANADEUS ASCII banner and a system readiness check.

---

## 🔑 API Configuration

ANADEUS uses AI providers for intelligent decision-making across phases. The system supports a **dual-provider architecture** with automatic fallback.

### Step 1 — Create Your `.env` File

Copy the example configuration:

```bash
cp .env.example .env
```

Then fill in your keys:

```env
# ──────────────────────────────────────────────────
# ANADEUS — AI Provider Configuration
# ──────────────────────────────────────────────────

# PRIMARY PROVIDER: Bytez
BYTEZ_API_KEY=your_bytez_api_key_here
BYTEZ_BASE_URL=https://api.bytez.com/v1
BYTEZ_MODEL=your_preferred_model

# FALLBACK PROVIDER: OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini
```

### Step 2 — Where to Get API Keys

| Provider | Sign Up | Notes |
|---|---|---|
| **Bytez** | [bytez.com](https://bytez.com) | Primary provider — faster, dedicated infrastructure |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | Fallback provider — access to 200+ models, pay-per-token |

> **Tip:** You only need **one** provider configured to get started. If both are set, Bytez is used first with OpenRouter as automatic fallback.

### Step 3 — Environment Loading

ANADEUS automatically reads environment variables from your `.env` file at startup — no additional configuration is needed. The `model_router` resolves providers from `process.env` automatically.

---

## 💻 Usage

### Individual Phase Commands

Run specific phases of the pipeline manually:

```bash
# Reconnaissance — subdomain enumeration, alive host detection, tech fingerprinting
node src/index.js chat --message "@recon example.com"

# Scanning — port scanning, directory/endpoint discovery, web server analysis
node src/index.js chat --message "@scan example.com"

# Analysis — vulnerability candidate identification using heuristics + AI
node src/index.js chat --message "@analysis example.com"

# Exploit — safe validation of SQL injection, XSS, IDOR, CSRF, Auth Bypass
node src/index.js chat --message "@exploit example.com"

# Report — impact assessment, PoC compilation, final markdown report
node src/index.js chat --message "@report example.com"
```

### 🤖 Full Auto Mode (Recommended)

Run the entire pipeline autonomously — the AI decides what to run next:

```bash
# Deep scan — thorough reconnaissance and analysis
node src/index.js auto --target example.com --deep

# Light scan — faster execution, reduced scope
node src/index.js auto --target example.com --mode light
```

### Agent Mode

Run specific agent commands directly:

```bash
node src/index.js agent recon example.com
node src/index.js agent scan example.com
```

### Structured Output

Get JSON output for automation and scripting:

```bash
node src/index.js agent recon example.com --json
```

### Dashboard

Launch the real-time web dashboard:

```bash
npm run dashboard
```

---

## 📁 Project Structure

```
anadeus/
├── src/                          # Core application source
│   ├── index.js                  # Entry point + early CLI validation
│   ├── cli/                      # Commander.js program + subcommands
│   │   ├── program.js            # CLI program definition
│   │   └── commands/             # Individual command handlers
│   ├── config/                   # Default settings + phase task templates
│   ├── core/                     # Engine modules
│   │   ├── ai/                   # AI-powered decision layer
│   │   │   ├── decision_engine.js    # Auto-pipeline phase orchestration
│   │   │   ├── model_router.js       # Bytez/OpenRouter dual-provider router
│   │   │   ├── prompt_engine.js      # Dynamic prompt generation
│   │   │   ├── context_engine.js     # Target context aggregation
│   │   │   └── scoring.js            # Phase scoring + confidence calibration
│   │   ├── performance/          # Optimizer + tool option sanitization
│   │   └── testing/              # Test runner framework
│   ├── runtime/                  # CLI runtime factory
│   ├── services/                 # Input routing, orchestration, auto-mode
│   └── ui/                       # Terminal formatters
│
├── agents/                       # Autonomous phase agents
│   ├── recon/                    # Reconnaissance agent + utilities
│   ├── scanner/                  # Scanner agent + payload builder
│   ├── analysis/                 # Vulnerability analysis agent
│   ├── exploit/                  # Safe exploit validation agent
│   └── report/                   # Impact assessment + final reports
│
├── orchestrator/                 # Phase execution engine
│   ├── orchestrator.js           # Phase runner + tool executor
│   ├── phase_manager.js          # State management (meta.json SSOT)
│   ├── task_engine.js            # Task execution with fallback chains
│   └── logger.js                 # Structured logging
│
├── tool_runner/                  # Python tool backend
│   ├── engine.py                 # Subprocess execution engine
│   ├── main.py                   # Tool runner entry point
│   ├── tools/                    # Individual tool wrappers
│   │   ├── nmap.py               # Port/service scanning
│   │   ├── subfinder.py          # Subdomain enumeration
│   │   ├── httpx.py              # HTTP probing + tech detection
│   │   ├── ffuf.py               # Directory fuzzing
│   │   ├── nikto.py              # Web server scanning
│   │   ├── whatweb.py            # Technology fingerprinting
│   │   ├── webprobe.py           # Custom HTTP probe
│   │   ├── socketprobe.py        # Custom port probe
│   │   ├── routeprobe.py         # Custom endpoint discovery
│   │   └── ...                   # amass, dirsearch, feroxbuster, etc.
│   ├── parsers/                  # Tool output parsers
│   └── utils/                    # Shared Python utilities
│
├── dashboard/                    # Web UI
│   ├── backend/                  # Express + Socket.IO server
│   └── frontend/                 # HTML/CSS/JS interface
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # Full architecture specification
│   └── assets/                   # Images and media
│
├── test/                         # Test suites
├── workspace/                    # Per-target output (gitignored)
├── logs/                         # Execution logs (gitignored)
├── .env.example                  # Environment template
├── .gitignore                    # Git exclusion rules
├── package.json                  # Node.js manifest
├── tool_runner.py                # Python tool runner bridge
└── README.md                     # This file
```

---

## 📊 Dashboard

ANADEUS includes a real-time web dashboard for visual monitoring:

```bash
# Build dashboard CSS (one time)
npm run dashboard:css

# Start the dashboard server
npm run dashboard
```

The dashboard provides:
- Live phase progress tracking
- Tool execution logs in real time
- Workspace and artifact browsing
- WebSocket-powered updates via Socket.IO

---

## 🔒 Safe GitHub Push Guide

Before pushing your code to a public repository, follow these steps to ensure no sensitive data is exposed.

### Pre-Push Checklist

```bash
# 1. Verify .env is NOT tracked
git status | grep ".env"
# Should return nothing — .env must be in .gitignore

# 2. Remove workspace data (contains target-specific results)
rm -rf workspace/

# 3. Clear execution logs
rm -rf logs/

# 4. Remove Python cache
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -name "*.pyc" -delete

# 5. Verify nothing sensitive is staged
git diff --cached --name-only
```

### Required `.gitignore` Entries

Your `.gitignore` must include these entries (already configured):

```gitignore
# Secrets
.env

# Dependencies
node_modules/

# Output data
workspace/
logs/

# Build artifacts
coverage/
dist/

# System files
.DS_Store
Thumbs.db

# Python cache
__pycache__/
*.pyc
*.log
```

### Safe Push Commands

```bash
git add -A
git status                  # Review carefully — no .env, no workspace/
git commit -m "your commit message"
git push origin main
```

---

## 🤝 Contributing

Contributions are welcome! Whether it's bug fixes, new tool integrations, or documentation improvements.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Commit** your changes: `git commit -m "Add your feature"`
4. **Push** to the branch: `git push origin feature/your-feature`
5. **Open** a Pull Request

### Development Setup

```bash
git clone https://github.com/yourusername/anadeus.git
cd anadeus
npm install
npm test                    # Run the test suite
```

### Guidelines

- Follow existing code style (ES modules, functional patterns)
- Add tests for new agents or tool integrations
- Never commit API keys, targets, or scan results
- Security tools must operate in safe/passive mode by default

---

## ⚠️ Security Disclaimer

> **ANADEUS is designed exclusively for authorized security testing, educational research, and bug bounty programs.**
>
> - Only use this tool on systems you own or have **explicit written permission** to test.
> - Unauthorized access to computer systems is **illegal** and punishable under law (CFAA, CMA, and equivalents worldwide).
> - The developers assume **no liability** for misuse or damage caused by this tool.
> - All exploit validation uses **harmless, non-destructive probes** — but always verify scope with program owners.
>
> **By using ANADEUS, you agree to use it responsibly and legally.**

---

## ☕ Support the Project

If ANADEUS helps your security research or bug bounty workflow, consider supporting its development:

<p align="center">
  <a href="https://buymeacoffee.com/chandanpandit">
    <img src="https://img.shields.io/badge/☕_Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" height="50" />
  </a>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/chandanpandit">buymeacoffee.com/chandanpandit</a>
</p>

Your support keeps ANADEUS free, open-source, and actively maintained. Every contribution funds server costs, tool research, and new feature development. ❤️

---

## ⭐ Star History

If you find ANADEUS useful, give it a ⭐ on GitHub — it helps others discover the project!

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

```
MIT License

Copyright (c) 2026 Chandan Pandey

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  <strong>Built with 🧠 by <a href="https://github.com/yourusername">Chandan Pandey</a></strong>
  <br />
  <em>ANADEUS — Making AI-powered cybersecurity accessible to everyone.</em>
</p>

<p align="center">
  <img src="./docs/assets/banner.png" alt="ANADEUS – AI Cybersecurity Brain" width="100%" />
</p>

<h1 align="center">⚡ ANADEUS</h1>

<p align="center">
  <strong>AI-Powered Cybersecurity & Bug Bounty Automation Platform</strong>
</p>

<p align="center">
  <em>The autonomous brain that hunts bugs while you sleep.</em><br/>
  <em>Recon → Scan → Analysis → Exploit → Report — fully AI-driven.</em>
</p>

<br/>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/⚡_Quick_Start-00C7B7?style=for-the-badge&logoColor=white" alt="Quick Start" /></a>&nbsp;
  <a href="#-usage--commands"><img src="https://img.shields.io/badge/💻_Commands-0078D4?style=for-the-badge&logoColor=white" alt="Commands" /></a>&nbsp;
  <a href="#-api-configuration"><img src="https://img.shields.io/badge/🔑_API_Setup-FF6B6B?style=for-the-badge&logoColor=white" alt="API Setup" /></a>&nbsp;
  <a href="https://buymeacoffee.com/chandanpandit"><img src="https://img.shields.io/badge/☕_Support-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-≥20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />&nbsp;
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />&nbsp;
  <img src="https://img.shields.io/badge/Kali_Linux-557C94?style=flat-square&logo=kalilinux&logoColor=white" alt="Kali Linux" />&nbsp;
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License" />&nbsp;
  <img src="https://img.shields.io/badge/Build-Production-brightgreen?style=flat-square" alt="Status" />
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

## 🧠 What is ANADEUS?

**ANADEUS** is not just another scanner — it's an **AI cybersecurity brain** that thinks, adapts, and executes like a senior penetration tester.

It orchestrates **5 autonomous agents** across a complete attack pipeline, powered by LLM-driven decision-making. From subdomain discovery to a polished vulnerability report with PoC evidence — one command does it all.

> **Built for:** Security researchers · Penetration testers · Bug bounty hunters · Red teams

<br/>

<p align="center">
  <code>@auto example.com --deep</code>
  <br/><br/>
  <strong>↓ &nbsp; That's it. ANADEUS handles the rest. &nbsp; ↓</strong>
</p>

<br/>

```
  ┌─────────┐    ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
  │  RECON   │───▶│  SCAN   │───▶│ ANALYSIS │───▶│ EXPLOIT  │───▶│ REPORT  │
  │  Agent   │    │  Agent  │    │  Agent   │    │  Agent   │    │  Agent  │
  └─────────┘    └─────────┘    └──────────┘    └──────────┘    └─────────┘
   Subdomains     Port scan      AI-powered       Safe PoC       Impact +
   Alive hosts    Directories    vuln candidates   validation    Final report
   Tech detect    Web servers    Prioritization   Zero-damage    Markdown PoC
```

---

## ✨ Features

### 🤖 Multi-Agent Autonomous Pipeline

| Agent | What It Does |
|---|---|
| **🔍 Recon Agent** | Subdomain enumeration, alive host detection, technology fingerprinting |
| **📡 Scanner Agent** | Port/service scanning, directory fuzzing, endpoint discovery, web server analysis |
| **🧪 Analysis Agent** | AI + heuristic vulnerability candidate identification and prioritization |
| **💥 Exploit Agent** | Safe validation of SQLi, XSS, IDOR, CSRF, Auth Bypass — zero destructive payloads |
| **📄 Report Agent** | Impact assessment, confidence scoring, PoC markdown, final report generation |

### 🧠 AI Decision Engine

- **Dual-provider architecture** — Bytez (primary) + OpenRouter (fallback)
- Intelligent phase selection based on context quality and completed work
- Automatic confidence calibration and scoring
- Context-aware prompt generation for each phase

### 🛠️ 14+ Integrated Security Tools

```
Subfinder  ·  Amass  ·  Assetfinder  ·  httpx  ·  WhatWeb
Nmap  ·  ffuf  ·  dirsearch  ·  Feroxbuster  ·  Nikto
WebProbe  ·  SocketProbe  ·  RouteProbe  ·  and more...
```

> Every tool has a **smart fallback chain** — if `nmap` fails, `socketprobe` takes over instantly. No phase ever silently dies.

### 🔐 Production-Grade Reliability

- **Strict tool option sanitization** — per-tool schemas prevent option leakage across fallback chains
- **Deterministic state management** — atomic writes, hard resets, single source of truth
- **Early CLI injection prevention** — malicious targets rejected before anything executes
- **Degraded scan recovery** — empty results trigger automatic retry with alternate tools

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Why |
|---|---|---|
| **Node.js** | ≥ 20.x | Core runtime |
| **Python** | ≥ 3.9 | Tool runner |
| **Kali Linux** | 2024.x+ | Pre-installed security tools |

### Installation

```bash
# 1. Clone
git clone https://github.com/thecnical/ANADEUS.git
cd ANADEUS

# 2. Install dependencies
npm install
pip install -r requirements.txt

# 3. Configure API keys
cp .env.example .env
# → Edit .env with your keys (see API Configuration below)

# 4. Verify
npm run banner
```

> **Note:** Nmap, Subfinder, ffuf, Nikto, etc. come pre-installed on Kali Linux. On other distros, install them via your package manager.

---

## 🔑 API Configuration

ANADEUS uses a **dual-provider AI architecture** with automatic fallback.

### Create Your `.env` File

```bash
cp .env.example .env
```

```env
# ── PRIMARY: Bytez ──────────────────────────
BYTEZ_API_KEY=your_bytez_key_here
BYTEZ_BASE_URL=https://api.bytez.com/v1
BYTEZ_MODEL=your_preferred_model

# ── FALLBACK: OpenRouter ────────────────────
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini
```

### Where to Get Keys

| Provider | Link | Notes |
|---|---|---|
| **Bytez** | [bytez.com](https://bytez.com) | Primary — fast, dedicated infrastructure |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | Fallback — 200+ models, pay-per-token |

> 💡 You only need **one** provider to get started. Both configured? Bytez runs first, OpenRouter kicks in automatically on failure.

ANADEUS auto-loads `.env` at startup — no extra setup needed.

---

## 💻 Usage & Commands

### 🤖 Full Auto Mode *(Recommended)*

Let the AI brain run the entire pipeline:

```bash
# Deep scan — full pipeline, thorough analysis
node src/index.js auto --target example.com --deep

# Light scan — faster, reduced scope
node src/index.js auto --target example.com --mode light
```

### 🎯 Individual Phase Commands

Run specific phases manually:

```bash
@recon example.com          # Subdomain enum + alive detection + tech fingerprinting
@scan example.com           # Port scan + directory fuzzing + web server analysis
@analysis example.com       # AI vulnerability identification + prioritization
@exploit example.com        # Safe PoC validation (SQLi, XSS, IDOR, CSRF, Auth)
@report example.com         # Impact assessment + final markdown report
```

Via CLI:

```bash
node src/index.js chat --message "@recon example.com"
node src/index.js chat --message "@scan example.com"
node src/index.js chat --message "@analysis example.com"
node src/index.js chat --message "@exploit example.com"
node src/index.js chat --message "@report example.com"
```

### 🕹️ Agent Mode

```bash
node src/index.js agent recon example.com
node src/index.js agent scan example.com
node src/index.js agent recon example.com --json     # Structured JSON output
```

### 📊 Web Dashboard

```bash
npm run dashboard       # Launch real-time monitoring UI
```

Live phase tracking · Tool execution logs · WebSocket updates · Artifact browser

---

## ⚠️ Security Disclaimer

> **🚨 ANADEUS is designed exclusively for authorized security testing, educational research, and legitimate bug bounty programs.**
>
> ❌ **DO NOT** use on systems without explicit written permission.
>
> ⚖️ Unauthorized access is **illegal** under CFAA, CMA, and equivalent laws worldwide.
>
> 🛡️ All exploit validation uses **harmless, non-destructive probes** — zero damage payloads.
>
> 📋 The developers assume **no liability** for misuse.
>
> **By using ANADEUS, you agree to use it responsibly, ethically, and legally.**

---

## 🤝 Contributing

Contributions are welcome — bug fixes, new tool integrations, documentation, and ideas.

1. **Fork** the repo
2. **Branch:** `git checkout -b feature/your-feature`
3. **Commit:** `git commit -m "Add your feature"`
4. **Push:** `git push origin feature/your-feature`
5. **PR** → Open a Pull Request

---

## ☕ Support the Project

If ANADEUS helps your security research or earns you bounties, consider fueling its development:

<p align="center">
  <a href="https://buymeacoffee.com/chandanpandit">
    <img src="https://img.shields.io/badge/☕_Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" height="55" />
  </a>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/chandanpandit"><strong>→ buymeacoffee.com/chandanpandit ←</strong></a>
</p>

<p align="center">
  Your support keeps ANADEUS free, open-source, and actively maintained. ❤️<br/>
  Every coffee funds tool research, server costs, and new features.
</p>

---

## ⭐ Star This Repo

If ANADEUS saved you time, give it a **⭐** — it helps others discover the project and motivates continued development!

---

## 📜 License

**MIT License** — see [LICENSE](./LICENSE) for details.

Copyright © 2026 **Chandan Pandey**. Free to use, modify, and distribute.

---

<p align="center">
  <strong>Built with 🧠 by <a href="https://github.com/thecnical">Chandan Pandey</a></strong>
  <br/>
  <em>ANADEUS — The AI that thinks like a hacker, so you don't have to.</em>
</p>

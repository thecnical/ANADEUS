# ANADEUS Architecture

## Overview

ANADEUS is a Kali Linux-based AI cybersecurity orchestration platform designed for ethical security testing and bug bounty workflows. The system is CLI-first, phase-driven, and context-aware. Every phase produces structured JSON that becomes the input for the next phase.

- Interaction split: CLI 80%, local web dashboard 20%
- AI routing: Bytez primary, OpenRouter fallback
- Execution model: orchestrated, operator-assisted, non-autonomous
- Data model: workspace-scoped, phase-based, JSON handoff between modules

## Architecture Diagram

```text
                                   +---------------------------+
                                   |      Human Operator       |
                                   |  CLI-first / Local Web    |
                                   +-------------+-------------+
                                                 |
                      +--------------------------+--------------------------+
                      |                                                     |
                      v                                                     v
            +--------------------+                              +----------------------+
            |   Node.js CLI UX   |                              | Local Web Dashboard  |
            | commander + chalk  |                              | React + Socket.io    |
            +---------+----------+                              +----------+-----------+
                      |                                                    |
                      +--------------------------+-------------------------+
                                                 |
                                                 v
                                   +---------------------------+
                                   |   Orchestrator Engine     |
                                   | Plan -> Execute -> Verify |
                                   +-------------+-------------+
                                                 |
                            +--------------------+--------------------+
                            |                                         |
                            v                                         v
                 +------------------------+                +------------------------+
                 |   AI Brain Gateway     |                |   Workspace Manager    |
                 | Bytez -> OpenRouter    |                | meta.json + phase JSON |
                 +-----------+------------+                +-----------+------------+
                             |                                         |
                             +--------------------+--------------------+
                                                  |
                                                  v
                                   +-------------------------------+
                                   |      Multi-Agent Layer        |
                                   | Recon / Scan / Analysis / ... |
                                   +---------------+---------------+
                                                   |
                                                   v
                                   +-------------------------------+
                                   |     Tool Runner (Python)      |
                                   | Kali tools -> JSON adapters   |
                                   +---------------+---------------+
                                                   |
                                                   v
                                   +-------------------------------+
                                   | Kali Tooling + Evidence Store |
                                   | nmap, subfinder, httpx, etc.  |
                                   +-------------------------------+
```

## Folder Structure

```text
ANADEUS/
+-- docs/
|   `-- ARCHITECTURE.md
+-- src/
|   +-- index.js
|   +-- cli/
|   |   +-- program.js
|   |   `-- commands/
|   |       +-- banner.js
|   |       +-- chat.js
|   |       +-- agent.js
|   |       `-- auto.js
|   +-- config/
|   |   +-- defaults.js
|   |   +-- tools.js
|   |   `-- providers.js
|   +-- core/
|   |   +-- command-parser.js
|   |   +-- modes.js
|   |   +-- phase-registry.js
|   |   `-- errors.js
|   +-- runtime/
|   |   +-- create-cli-runtime.js
|   |   `-- session-context.js
|   +-- orchestrator/
|   |   +-- engine.js
|   |   +-- phase-manager.js
|   |   +-- retry-policy.js
|   |   `-- fallback-policy.js
|   +-- ai/
|   |   +-- gateway.js
|   |   +-- bytez-client.js
|   |   +-- openrouter-client.js
|   |   +-- prompts/
|   |   |   +-- planning.js
|   |   |   +-- analysis.js
|   |   |   `-- report.js
|   |   `-- schemas/
|   +-- agents/
|   |   +-- base-agent.js
|   |   +-- recon-agent.js
|   |   +-- scanner-agent.js
|   |   +-- vulnerability-analysis-agent.js
|   |   +-- exploitation-agent.js
|   |   +-- poc-agent.js
|   |   +-- impact-analysis-agent.js
|   |   +-- report-agent.js
|   |   `-- validator-agent.js
|   +-- services/
|   |   +-- input-router.js
|   |   +-- workspace-service.js
|   |   +-- tool-runner-service.js
|   |   `-- report-service.js
|   +-- storage/
|   |   +-- workspace-manager.js
|   |   +-- json-store.js
|   |   `-- artifact-index.js
|   +-- ui/
|   |   +-- banner.js
|   |   +-- formatters.js
|   |   `-- interactive-shell.js
|   `-- web/
|       +-- server/
|       |   +-- app.js
|       |   +-- routes/
|       |   `-- sockets/
|       `-- dashboard/
|           +-- src/
|           `-- public/
+-- python/
|   +-- runner.py
|   +-- adapters/
|   |   +-- nmap_adapter.py
|   |   +-- subfinder_adapter.py
|   |   +-- httpx_adapter.py
|   |   `-- nuclei_adapter.py
|   +-- parsers/
|   `-- schemas/
+-- workspace/
|   `-- {target}/
|       +-- meta.json
|       +-- recon/
|       |   +-- raw/
|       |   `-- recon.json
|       +-- scan/
|       |   +-- raw/
|       |   `-- scan.json
|       +-- analysis/
|       |   `-- analysis.json
|       +-- exploit/
|       |   `-- exploit.json
|       +-- poc/
|       |   `-- poc.json
|       +-- impact/
|       |   `-- impact.json
|       +-- report/
|       |   `-- report.json
|       `-- validation/
|           `-- validation.json
`-- test/
    +-- unit/
    +-- integration/
    `-- fixtures/
```

## Data Flow Pipeline

```text
Operator Input
  -> CLI Parser
  -> Orchestrator
  -> AI Planning Prompt
  -> Phase Task List
  -> Tool Runner Execution
  -> Structured JSON Output
  -> Workspace Persistence
  -> Next Agent Reads Previous JSON
  -> Next Phase Refines Findings
  -> Final Report + Validation
```

Detailed phase handoff:

1. Recon
   Reads target profile and scope.
   Writes `workspace/{target}/recon/recon.json`.
2. Scan
   Reads recon JSON.
   Writes `workspace/{target}/scan/scan.json`.
3. Analysis
   Reads scan JSON and tool evidence.
   Writes `workspace/{target}/analysis/analysis.json`.
4. Exploit
   Reads analysis JSON.
   Writes `workspace/{target}/exploit/exploit.json`.
5. PoC
   Reads exploit JSON.
   Writes `workspace/{target}/poc/poc.json`.
6. Impact
   Reads PoC JSON.
   Writes `workspace/{target}/impact/impact.json`.
7. Report
   Reads all validated evidence and impact data.
   Writes `workspace/{target}/report/report.json`.
8. Validation
   Reads final report JSON plus prior artifacts.
   Writes `workspace/{target}/validation/validation.json`.

## Module Responsibilities

### CLI System

- Entry point for operator interaction
- Supports chat mode, `@agent` commands, and `/file` commands
- Renders banner, system status, summaries, and actionable feedback
- Dispatches requests into orchestrator-safe actions

### Workspace Storage System

- Creates `workspace/{target}/` automatically
- Tracks current phase and evidence status in `meta.json`
- Persists raw tool output and normalized JSON output
- Provides context retrieval for agents and dashboard views

### Orchestrator Engine

- Converts operator intent into executable phase plans
- Maintains sequential phase order
- Applies retry logic and fallback tool/provider logic
- Blocks unsafe or out-of-scope transitions
- Publishes progress updates to CLI and dashboard

### Tool Runner (Python)

- Executes Kali Linux tools in a controlled subprocess layer
- Normalizes raw text/XML/JSON tool output into stable JSON schemas
- Returns machine-readable results to Node.js
- Encapsulates tool-specific parsing and adapter logic

### AI Brain System

- Sends structured prompts to Bytez as primary model provider
- Falls back to OpenRouter when Bytez fails or times out
- Enforces prompt templates for planning, analysis, and reporting
- Produces structured JSON plans and findings, not direct tool execution

### Multi-Agent System

- Implements specialized reasoning per phase
- Requires each agent to read the previous phase JSON
- Emits structured task plans, findings, and next-step recommendations
- Prevents redundant work by using workspace context and artifact history

### Web Dashboard

- Local-only operator dashboard
- Shows target list, phase state, findings, and reports
- Streams live progress through Socket.io
- Reads the same workspace JSON as the CLI

## Multi-Agent Responsibilities

### Recon Agent

- Builds reconnaissance task list
- Identifies domains, subdomains, technologies, and exposed surfaces

### Scanner Agent

- Chooses scan strategy from recon context
- Prioritizes coverage, accuracy, and safe validation

### Vulnerability Analysis Agent

- Correlates scan results with exploitability signals
- Filters false positives and ranks confidence

### Exploitation Agent

- Designs safe verification steps
- Produces evidence requirements for manual or assisted validation

### PoC Agent

- Converts validated exploitation paths into reproducible proof-of-concept steps
- Enforces scope-aware, non-destructive output

### Impact Analysis Agent

- Assesses severity, business impact, blast radius, and likely abuse paths

### Report Agent

- Produces structured bug bounty and pentest narratives
- Maps evidence to remediation-ready report sections

### Validator Agent

- Checks completeness, consistency, and evidence integrity across all phases
- Rejects weak or unsupported findings before final output

## Context Model

Each target workspace maintains:

- `meta.json`
  - target
  - scope
  - active phase
  - phase completion status
  - tool history
  - model/provider history
  - timestamps
- phase JSON files
  - findings
  - evidence
  - confidence
  - todo items
  - next-phase inputs

## Failure Handling Strategy

- Tool fails
  - Retry with adjusted arguments
  - Fallback to alternate tool adapter
  - Record failure in phase JSON and `meta.json`
- AI provider fails
  - Retry Bytez
  - Fallback to OpenRouter
  - Mark provider switch in orchestration log
- Invalid or low-confidence result
  - Trigger validator review
  - Request alternate analysis path
  - Escalate to manual review recommendation
- No findings
  - Launch deeper analysis checklist
  - Expand recon/scan breadth before closing phase

## Development Phases

1. CLI Foundation
   Commander-based CLI, banner system, input routing, basic runtime shell.
2. Workspace System
   Target folder bootstrapping, `meta.json`, phase folder creation, JSON store.
3. Tool Runner
   Python subprocess runner, adapter layer, structured tool result schemas.
4. Orchestrator
   Phase manager, retry/fallback engine, execution state machine.
5. Recon Agent
   Recon planning, task list generation, recon JSON output.
6. Scanner Agent
   Scan strategy, tool selection, structured scan evidence handling.
7. AI Integration
   Bytez primary client, OpenRouter fallback client, prompt templates, schema validation.
8. Multi-Agent System
   Full agent registry, cross-phase coordination, validator gating.
9. Reporting Engine
   Report synthesis, remediation summaries, export-ready findings output.
10. Web Dashboard
    React dashboard, Socket.io streaming, local artifact visualization.

## Operational Principles

- CLI remains the primary control surface
- Dashboard is read-heavy and operator-assistive
- Agents reason, orchestrator decides, tool runner executes
- Every phase is explicit, inspectable, and replayable
- Every meaningful artifact is stored as JSON for traceability

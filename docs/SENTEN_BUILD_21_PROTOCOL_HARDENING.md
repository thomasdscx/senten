# Senten Build 21 — Protocol Completion & Security Hardening

Version target: `0.21.1-alpha.0`

Build 21 deepens three pre-1.0 boundaries: framework adapter IR emission, deterministic effect containment, and MCP transport.

## 1. Application IR Fragment SPI

Framework adapters may emit versioned `ApplicationIRFragment` objects rather than mutating StateTruss directly. Fragments include adapter identity/version, source files, confidence, diagnostics, semantic nodes/edges, and optional evidence.

Senten validates fragments before merge. The merger is deterministic, preserves adapter provenance on nodes/edges, rejects semantic kind collisions, and drops unresolved edges with diagnostics rather than silently inventing graph structure.

First-party alpha adapters now exercise the SPI for Next.js, Expo, and Tauri. React's legacy analyzer contribution remains supported during migration.

## 2. Sandbox Effect Firewall

`senten sandbox run ... --include-actions -- ...` declares mutation intent. Senten fails closed unless the run has an enforceable boundary:

- Docker + `network=deny`: contained mutation mode. Docker's network namespace blocks external network access and only the isolated workspace is mounted from the host.
- Local workspace-copy or Docker with inherited networking: denied unless the operator explicitly supplies `--allow-live-effects`.

`--allow-live-effects` is an explicit escape hatch, not a safety claim. The run ledger records the effect intent and boundary mode.

Browser `clickthru --include-actions` similarly requires `--allow-live-effects` because Playwright on the host is not a network containment boundary. For deterministic mutation probes, run the application inside a network-denied sandbox.

## 3. MCP stdio transport

`senten mcp serve` implements a JSON-RPC stdio MCP server with:

- `initialize`
- `ping`
- `tools/list`
- `tools/call`
- line-delimited JSON framing
- process timeout and output limits
- shell-free child execution
- read-only tools by default

Mutating tools are hidden unless the operator explicitly starts the server with `--allow-write`.

Use:

```bash
senten mcp serve
senten mcp serve --allow-write
```

The default is deliberately read-only. Agent authorization remains layered: exposing a tool over MCP does not grant external credentials or production authority.

## 4. Pre-1.0 posture

Build 21 does not claim that arbitrary allowlisted outbound networking is globally intercepted. The production guarantee available today is stronger and narrower: Docker `network=deny` is the supported deterministic external-network boundary for mutating sandbox probes. Domain-level egress allowlisting remains a later provider capability and must not be represented as equivalent until enforced below the application layer.

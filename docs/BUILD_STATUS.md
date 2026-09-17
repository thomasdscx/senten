# Senten Build Status

## Build 1 — Foundation — COMPLETE
StateTruss/Application IR, Universal Elements, contracts, policies, invariants, runtime primitives, extension SDK and safe file operations.

## Build 1.5/1.6 — State, Reuse & Workflow Foundation — COMPLETE
SQLite local state, append-only operation ledger, undo/redo, sessions, transactions, checkpoints, scoped memory, profiles, templates, blueprints, package/registry foundations and deterministic workflows.

## Build 2 — Source Intelligence — COMPLETE
TypeScript/JavaScript AST discovery, content-addressed cache, automatic StateTruss population, semantic diff, baselines, drift and extension-provided source analyzers.

## Build 3 — Sandbox Hardening — COMPLETE
Sanitized local workspaces, Docker provider, network/resource controls, synthetic secrets, snapshots, run history and replay foundations.

## Build 4 — Interaction Assurance — COMPLETE
HTTP crawl, Playwright clickthrough, deterministic journeys, path graph, findings and interaction evidence.

## Build 5 — Agent Intelligence — COMPLETE
Bounded agent identities/grants, Task Context Bundles, agent-run provenance, Change Bundles, machine command discovery and MCP-facing schema foundation.

## Build 6 — Runtime State & Evidence Intelligence — COMPLETE

Version: `0.6.0-alpha.0`

Implemented:

- durable runtime observations and traces;
- JSON/JSONL runtime ingestion;
- semantic runtime alignment/drift reporting;
- evidence ledger with explicit evidence strength ladder;
- evidence-to-StateTruss support/contradiction edges;
- interaction runs producing evidence records;
- `senten guarantee` evidence evaluation;
- evidence-backed `senten proof`;
- runtime/evidence sinks in `ExecutionEngine`;
- fail-closed handling for missing/contradictory evidence;
- runtime/evidence command capabilities for agents;
- 32 passing automated tests plus CLI smoke verification.

## Build 7 — Observatory & Canonical Reporting — COMPLETE

Version: `0.7.0-alpha.0`

Implemented:

- canonical project intelligence snapshot;
- local-first read-only Observatory;
- architecture, evidence, runtime, interaction, agent and operation views;
- JSON/Markdown/self-contained printable HTML reports;
- report SHA-256 integrity and durable report history;
- loopback-only default binding with explicit remote exposure gate;
- Observatory API endpoints backed by the same canonical reporting model;
- 35 passing automated tests.

## Build 8 — Extension Ecosystem — COMPLETE

Version: `0.8.0-alpha.0`

Implemented:

- decentralized local + read-only HTTP registry transport;
- static `index.json` registry protocol;
- package materialization without executing downloaded code;
- Ed25519 package signing and publisher trust store;
- SHA-256 integrity kept distinct from publisher trust;
- package compatibility contracts for Senten and Node;
- fail-closed remote package installation unless trusted or explicitly overridden;
- extension manifest validation and per-command capability declarations;
- machine-readable extension inspection/validation;
- 39 passing automated tests including registry, signature, compatibility and extension validation coverage.

## Build 9 — LaunchProof Assurance — COMPLETE

Version: `0.9.0-alpha.0`

Implemented:

- formal Senten Assurance Exchange v0.1;
- stable semantic assurance claims for invariants, policies, actions, routes and resources;
- exact StateTruss + exchange digests;
- metadata secret redaction during assurance export;
- native `senten launchproof export/import/status` workflow;
- LaunchProof result binding to exact exported bundle IDs/digests;
- Ed25519 LaunchProof result verification through Senten publisher trust;
- unsigned/untrusted verifier results downgraded to tested evidence;
- trusted LaunchProof results mapped to strength-4 verified evidence;
- fail-closed rejection of mismatched/tampered claim results;
- first-class Assurance Cases and conservative derived status;
- assurance information in canonical project reports;
- manual strength-4 evidence creation blocked;
- 44 passing automated tests.

## Build 10 — v1 Hardening — COMPLETE

Version: `0.10.2-alpha.0`

Implemented:

- explicit SQLite schema versioning + migration ledger;
- database integrity checks and strict/JSON doctor output;
- fail-closed `senten release check`;
- common secret-file/publication checks;
- local performance benchmark command;
- machine-readable command schema surface;
- top-level CLI typo suggestions;
- security, contributing, governance, code-of-conduct and API stability docs;
- hardened CI defaults;
- release-readiness regression tests.

Build 10 is a public-release readiness milestone. Senten remains alpha until broader dogfooding and protocol/API stabilization are complete.


## Build 10.2 — CLI Experience Hardening ✅

Validated CLI workflow builder, first-run diagnostics, sandbox syntax guidance, and cross-platform acceptance refinements. Automated suite: 51 passing tests in the build environment.

## Build 11 — Distribution & Release Engineering ✅

Version: `0.11.0-alpha.0`

Implemented:

- publishable root `senten` npm CLI package shape;
- runtime TypeScript compiler dependency for Source Intelligence;
- Windows/macOS/Linux Node 22 CI matrix;
- Docker build/smoke workflow;
- GHCR multi-architecture tagged releases;
- keyless Cosign container signing;
- GitHub release tarball/checksum/SBOM artifacts;
- manually gated npm provenance publishing;
- alpha/beta/stable channel policy;
- `senten create sandbox` friendly alias;
- cross-shell distribution documentation.

## Builds 12–20 — Capability Sprint ✅

Version: `0.20.0-alpha.0`

Implemented cumulatively:

- release/docs hardening and OIDC-shaped npm Trusted Publishing workflow;
- existing-application adoption analysis with `senten adopt`;
- richer explicit semantic declaration, relations, `why`, and lineage traversal;
- provider-neutral Capability Runtime with health, priority, fail-closed degraded behavior and operational budgets;
- project-scoped Git identity context, Git doctor, agent-context enrichment and multi-agent handoff artifacts;
- declarative safe simulation plans, list/inspect, responsive Playwright viewport support and horizontal-overflow findings;
- signed extension ecosystem audit surface;
- Observatory adoption/integration views and read-only APIs;
- explicit Application IR / command / extension / registry compatibility reporting;
- expanded MCP tool schema for the new capability surface;
- 66 passing automated tests in the build environment after the cumulative sprint.

Still intentionally experimental or externally gated:

- npm Trusted Publishing requires the package's npm-side trusted-publisher mapping before OIDC publishing can be proven;
- Playwright browser/device behavior requires browser binaries and real application targets for full hands-on validation;
- declarative simulation plans are not represented as executed fault-injection evidence;
- the Application IR and public protocols remain alpha and are not yet frozen for 1.0;
- native standalone binaries and WASM extension execution remain future stabilization work.


## Build 21 — Protocol Completion & Security Hardening ✅

Version: `0.21.1-alpha.0`

Implemented:

- formal versioned Application IR Fragment SPI for framework adapters;
- deterministic fragment validation/merge with stable semantic identity, adapter provenance, limits and collision diagnostics;
- first-party alpha adapters for Next.js, Expo and Tauri using the fragment SPI;
- source discovery/adoption integration for adapter fragments without executing repository code;
- fail-closed sandbox mutation effect boundary with Docker network-deny as the supported deterministic external-network containment mode;
- explicit live-effects escape hatch recorded in the sandbox run ledger;
- mutating browser click-through probes hardened behind a second explicit live-effects gate;
- real MCP stdio JSON-RPC transport with initialize/ping/tools list/tools call;
- read-only MCP exposure by default, separate write and live-effects gates;
- MCP request/output/timeout bounds and sanitized child-process environment;
- Extension Protocol marker advanced to `0.3`;
- 79 passing automated tests in the build environment.

Externally gated validation still required:

- Docker runtime smoke test on a host with Docker installed;
- Windows/macOS/Linux GitHub Actions for this exact commit;
- real Playwright/browser mutation checks against an explicitly authorized disposable target;
- npm/GHCR publication for `0.21.1-alpha.0` only after those gates pass.

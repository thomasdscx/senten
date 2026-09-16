# Changelog

## 0.11.1-alpha.0

- Fix npm distribution allowlist regression test without broadening published `dist/` contents.
- Add first-run CLI welcome and improved post-init guidance.
- Keep Node.js 22.5+ canonical and add non-blocking Bun experimental CI.
- Add runtime-support documentation for Node, Bun, Docker and future standalone binaries.


## 0.11.0-alpha.0 — Distribution & Release Engineering

- added cross-platform Windows/macOS/Linux CI matrix on Node 22;
- made the root `senten` CLI package publishable with a constrained npm file allowlist;
- moved TypeScript to a runtime dependency because Source Intelligence uses the compiler API at runtime;
- added npm alpha/beta/latest release-channel metadata and provenance-ready publish workflow;
- added multi-stage, unprivileged Docker image plus GHCR multi-architecture publishing;
- added keyless Cosign signing for tagged container images;
- added GitHub release artifact generation with npm tarball, SHA-256 manifest and CycloneDX SBOM;
- added `senten create sandbox` as a friendly alias for canonical `senten sandbox create`;
- documented PowerShell, Windows CMD, macOS/Linux and Docker installation/usage separately.

## 0.10.2-alpha.0 — CLI Experience Hardening

- Added CLI-native workflow authoring: `workflow add`, `remove`, `move`, `clear`, `steps`, and `validate`.
- Added `create workflow <name> --empty` for clean draft workflows.
- Added first-run `doctor` guidance for uninitialized directories.
- Added actionable sandbox `--` separator diagnostics.
- Added CLI regression coverage for first-run health, workflow authoring, and sandbox syntax guidance.
- Fixed the CLI version constant so `senten --version` matches the package release.
- Retained the Windows-neutral Source Intelligence path fix and serialized test runner from v0.10.1.

## 0.10.1-alpha.0

Windows acceptance hardening patch.

- fixed Source Intelligence relative-import resolution to use POSIX semantic paths independent of the host OS path implementation;
- added a regression assertion for normalized import edges;
- serialized Node test-file execution (`--test-concurrency=1`) to avoid Windows/Node worker cancellation around SQLite/crypto-heavy test files;
- preserves the Build 10 public-release hardening feature set without changing project-state schemas.

## 0.10.0-alpha.0 — Build 10: v1 Hardening

- Added explicit SQLite schema versioning and migration ledger.
- Added database integrity/schema checks to `senten doctor`, plus `--json` and `--strict`.
- Added `senten release check` with fail-closed readiness checks and common secret/publication checks.
- Added `senten benchmark` for repeatable StateTruss/local-state read-path measurements.
- Added `senten schema command <name>` and top-level typo suggestions.
- Added SECURITY, CONTRIBUTING, GOVERNANCE, Code of Conduct and API stability documentation.
- Added release-hardening tests and stronger CI defaults.
- Bumped workspace packages to `0.10.0-alpha.0`.

## 0.9.0-alpha.0 — Build 9: LaunchProof Assurance Integration

- Added formal Senten Assurance Exchange v0.1 with stable claim IDs and StateTruss binding.
- Added native `senten launchproof export`, `import`, and `status` commands.
- Added LaunchProof Verification Result validation against exact exchange ID/digest and claim subjects.
- Added Ed25519 verifier-result trust using the Senten trust store.
- Trusted LaunchProof verification produces strength-4 verified evidence; unsigned/untrusted results are conservatively downgraded to tested evidence.
- Added first-class Assurance Cases with derived incomplete/supported/verified/failed status.
- Added `senten assurance claims` and `senten assurance case ...` command family.
- Added `senten report assurance` and assurance metrics to the canonical project snapshot.
- Blocked manual creation of `verified` evidence so Senten cannot self-certify independent assurance.
- Added assurance exchange/result/case persistence to local SQLite state.
- Expanded automated suite to 44 passing tests.

## 0.8.0-alpha.0 — Build 8: Extension Ecosystem Hardening

- Added read-only HTTP registry protocol alongside local registries.
- Added remote registry search/fetch and package materialization without code execution.
- Added Ed25519 signing, key generation and local publisher trust store.
- Added package trust verification distinct from SHA-256 payload integrity.
- Added compatibility contracts for Senten and Node versions.
- Added fail-closed package installation for untrusted remote packages with explicit override.
- Added extension SDK validation for namespaces, versions, duplicate commands and element types.
- Added per-command extension capabilities for CLI/MCP discovery.
- Added Extension Ecosystem specification and migration guide.
- Expanded automated suite to 39 passing tests.

## 0.7.0-alpha.0 — Build 7: Observatory & Canonical Reporting

- Added local-first, read-only Senten Observatory web workbench.
- Added canonical project intelligence snapshot joining StateTruss, operations, memory, workflows, sandboxes, interaction assurance, agents, runtime and evidence.
- Added `senten report` with project/architecture/evidence/runtime/interactions/agents/operations report kinds.
- Added JSON, Markdown and self-contained printable HTML renderers.
- Added durable report ledger with SHA-256 report digests and provenance.
- Added Observatory APIs for snapshot, graph, operations, evidence, runtime, interactions and agents.
- Observatory binds to loopback by default and requires explicit `--allow-remote` for non-loopback exposure.
- Added CSP, no-store responses and read-only HTTP behavior for the initial Observatory security boundary.
- Expanded automated suite to 35 passing tests.

## 0.6.0-alpha.0 — Build 6: Runtime State & Evidence Intelligence

- Added durable runtime observations and runtime traces.
- Added JSON/JSONL runtime ingestion and direct `senten runtime observe`.
- Added runtime-to-StateTruss alignment, runtime-only semantic detection and observational coverage.
- Added durable evidence ledger with explicit declared/observed/tested/verified/failed states.
- Added evidence strength summaries and StateTruss support/contradiction relationships.
- Added `senten evidence`, `senten guarantee`, and evidence-backed `senten proof`.
- Added automatic interaction evidence persistence for crawls/clickthrough routes and critical journeys.
- Added provider-neutral runtime/evidence sinks to `ExecutionEngine`.
- Added runtime/evidence agent capability mappings.
- Expanded automated suite to 32 passing tests.

## 0.5.0-alpha.0

- Added first-class bounded agent identities and explicit allow/deny grants.
- Added deterministic Task Context Bundles backed by StateTruss, memory and recent operations.
- Added agent-run provenance, durable history and Change Bundles.
- Added `senten context`, `senten commands --format json`, and MCP-facing schema output.
- Added fail-closed capability mapping for agent command execution.


## 0.4.0-alpha.0 — Build 4: Interaction Assurance

- Added Interaction Assurance subsystem and persistent interaction graph state.
- Added dependency-free `senten crawl` for route/link/HTTP health discovery.
- Added Playwright-backed `senten clickthru` with rendered control inventory, visibility/enabled checks, guarded click probing and null-interaction detection.
- Added deterministic journey definitions and `journey create/list/inspect/run/history`.
- Added `senten paths` for navigation graph inspection.
- Added interaction evidence nodes and runtime-route observations in StateTruss.
- Added safety filtering for potentially destructive/external click actions; deliberate `--include-actions` opt-in.
- Added optional browser-runtime model so normal Senten preflight does not require downloading Playwright browsers.
- Added Interaction Assurance specification and migration guide.
- Expanded automated suite to 22 passing tests.

## 0.3.0-alpha.0 — Build 3: Sandbox Hardening

- Hardened Sandbox Engine with local and Docker providers.
- Added persistent sandbox state, snapshots and run history.
- Added network-deny enforcement through Docker provider.
- Added resource/time/output budgets.
- Added synthetic secret virtualization.
- Added deterministic workspace digest and run reproduction.
- Added safe package-install simulation.

## 0.2.0-alpha.0 — Build 2: Source Intelligence

- Added TypeScript/JavaScript AST source discovery.
- Added content-addressed incremental parse cache.
- Added automatic StateTruss population from existing code.
- Added source-file, import, route, component, action, resource, test and external-provider semantics.
- Added extension-provided source analyzers.
- Added `senten discover`, `senten source`, baselines, semantic diff and architecture drift.

## 0.1.6-alpha.0

- Added safe `redo all` and deterministic Senten workflows.
- Added workflow inputs, conditions, nested workflows, rollback policies and package/registry support.

## 0.1.5-alpha.0

- Added SQLite local state, append-only operation ledger, scoped memory, profiles, templates, blueprints, package integrity and local registries.

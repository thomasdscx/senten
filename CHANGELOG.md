## 1.0.0-rc.26

- Security continuity: passphrase change requires current credential; fresh init cannot bypass registered secured-project identity.
- Five-attempt passphrase policy with recovery-required transition and persistent attempt counter.
- One-time recovery key, recovery rotation, and recovery-based passphrase reset with no universal backdoor.
- AES-256-GCM protected-state vault for StateTruss, local SQLite state, activity, reports, checkpoints, workflows, and AI provider metadata.
- Security doctor and explicit destructive reset semantics.

# Changelog

## 1.0.0-rc.25

- Security hotfix: interactive Senten passphrase entry is now masked with `*` characters instead of being echoed in plaintext.
- Preserves TTY-only human authorization, scrypt-based salted passphrase verification, temporary non-delegable leases, and AI/security policy boundaries from RC24.

## 1.0.0-rc.24

### Provider-neutral AI onboarding and governed interoperability

- Added `senten ai discover|list|status|inspect|models|use` for local/provider discovery and selection.
- Added zero-router local discovery for Ollama and LM Studio plus generic OpenAI-compatible provider registration.
- Added `senten ai ask` using Senten-built, policy-filtered project context and the active provider/model.
- Added a public provider contract surface under `dist/packages/ai-provider`. Provider credentials are referenced through environment variable names; plaintext API keys are not written to project config.
- MCP now exposes `ask`, `status`, `capabilities`, and `environment` as read-only surfaces; MCP `ask` automatically applies AI disclosure policy.
- Added `DENIED` command outcomes for successful security-policy enforcement instead of misclassifying authorization denials as runtime failures.
- Improved interactive passphrase setup with retry guidance while preserving TTY-only human authorization.
- Preserved model-independent `senten ask` as deterministic project-context retrieval.

### Release boundary

RC24 remains a packaged-runtime release candidate. Stable 1.0 still requires canonical TypeScript source reconciliation, source/package parity, publish hygiene, and final cross-platform verification before npm publication.

## 1.0.0-rc.22

- Added contextual command help and native-operation aliases (`senten build`, `senten test`, `senten lint`, `senten typecheck`, `senten dev`, `senten format`).
- Added Listen filesystem-event evidence to detailed reports with bounded Markdown output and complete JSON retention.
- Unified command outcome classification between reports and activity, including `INVALID_COMMAND` for exit code 2.
- Preserved `create --from` as the canonical source-derived creation primitive.

# Changelog

## 1.0.0-rc.21

- Fixed Windows `.cmd`/`.bat` invocation by centralizing a single `cmd.exe /d /s /c call ...` quoting layer.
- Unified tool version probing with the same Windows shim invocation used by runtime execution.
- Kept direct execution for `.exe`/`.com` tools; routine `shell: true` remains disabled.
- Listen now suppresses Senten-generated runtime/state writes while continuing to observe user-editable workflows, adapters, policies, templates, profiles, workspaces, and settings.
- Listen coalesces unambiguous same-directory Windows rename pairs into `RENAME old -> new` activity events and preserves add/delete when uncertain.
- Activity text and Markdown exports now render rename provenance.

## 1.0.0-rc.20

- Unified tool resolution across environment, plan, run, native and adapter execution.
- Added Windows PATH/PATHEXT resolution for `.cmd`, `.exe`, `.bat`, and `.com` launchers without restoring Node `shell: true`.
- Project-local executables remain preferred over system tools.
- `senten plan run` now displays tool version, scope, executable path, resolution source, and execution mode.
- Native execution telemetry records the exact resolved executable and provenance.
- Tool-resolution failures are distinguished from downstream project/native-tool failures.

# Senten 1.0.0-rc.19

- Workflow diff now shows canonical/local hashes, modification time, line counts, and a bounded unified diff using the same comparison semantics as reset.
- Interactive confirmation wait is separated from actual execution time in reports.
- Added UNAVAILABLE and SKIPPED evidence statuses so absent optional operations do not fail a session.
- Project command planning suggests related scripts when no canonical root operation exists.
- Native process execution no longer uses Node shell:true; Windows command shims use an explicit wrapper and reports capture bounded stdout/stderr plus failure classification.
- Every command record captures its Senten version and CLI executable, preserving provenance across upgrades during a long recording.

# Changelog

## 1.0.0-rc.18

- Clarify workflow ownership in CLI output: project boilerplates, project custom workflows, global custom workflows, and built-in canonical recovery definitions.
- `senten workflow list` groups effective workflows by ownership instead of presenting all project files as one undifferentiated group.
- `senten workflow list --all` labels provenance with explicit ownership classes while preserving ACTIVE/shadowed resolution status.
- `senten workflow inspect` reports the resolved workflow ownership kind.
- Preserve RC17 version-aware additive `senten init` reconciliation and canonical built-in recovery semantics.

## 1.0.0-rc.15

- Added layered Senten scopes: built-in, global/user, project, workspace, and command/session overrides.
- Added `senten scope`, `senten resolve`, `senten call`, and layered `senten config` commands.
- Added explicit workflow scope selection (`--global/-g`, `--project/-p`, `--builtin/-b`, `--workspace/-w`) plus `workflow list --all`.
- Added workflow copying across scopes with provenance metadata.
- Added global adapter directories, scoped adapter resolution, and explicit global adapter trust/enablement.
- Added effective configuration provenance and scoped settings files without changing canonical project architecture state.
- Preserved safe-by-default destructive confirmations and explicit trust gates.

# 1.0.0-rc.14

- Converted project workflows to human-editable Markdown-first files under `.senten/workflows/` while preserving JSON compatibility.
- Added built-in starter workflows: smoke, quality, release-check, architecture-check, security-context, and full-assurance.
- Added workflow templates, project/user/built-in resolution, direct file auto-discovery, validation, doctor, diff, planning, reset, backup/recovery, and safe removal behavior.
- `senten workflow reset` restores canonical boilerplates, preserves custom workflows, creates recovery backups, supports `--dry-run`, and requires `[y/N]` confirmation unless `--yes` is explicit.
- Added universal destructive-operation confirmation to workflow mutation, cache clear, lifecycle remove/purge/reset, finding clear, file deletion, sandbox destruction, and local-adapter enablement.
- Added `senten environment` for local runtime/tool/package-manager/version awareness without dependency installation.
- Added `senten run` and `senten plan run` to resolve project-native build/test/dev/lint/typecheck/format commands instead of reimplementing ecosystem CLIs.
- Added `senten native` for explicit local/native tool execution with visible resolution/version information.
- Added local adapter scaffolding/validation/conformance testing/enablement plus explicit trusted execution and namespaced native command declarations.
- Added local adapter source analyzers to discovery after explicit enablement; local adapter commands appear in `senten commands`.
- Added workflow source/hash provenance to workflow run records and project → user → built-in workflow resolution.
- Added StateTruss v1-RC runtime contract metadata, evidence-status/confidence helpers, snapshots, and semantic delta foundations.
- Added semantic graph cache keyed by source/workspace/framework/adapter fingerprints and optimized graph construction with set-based node/edge identity.
- Added granular semantic-graph progress events while indexing entities and resolving dependency relationships.

# 1.0.0-rc.13

- Discovery progress now represents the full command lifecycle instead of showing 100% when only the semantic graph phase is complete.
- Added explicit multi-phase progress for workspace detection, framework detection, repository inventory, cache/parsing, semantic graph, discovery manifest, StateTruss persistence, state metadata, and finalization.
- Large repositories (5,000+ modeled source files) now receive a clear notice that full discovery may take several minutes while live progress remains visible.
- Added phase-level timing evidence to discovery stats and detailed Markdown reports.
- Added unchanged-StateTruss reuse: when the newly discovered IR is semantically identical to the persisted IR, Senten skips rewriting the large StateTruss file and records graph reuse.
- Detailed reports now distinguish detected, modeled, and detection-only framework understanding.
- Security report language now distinguishes architectural security context from modeled authentication/authorization controls and imported scanner findings.
- Warm-discovery evidence now records graph reuse and phase timings so redundant work can be diagnosed and compared across reports.

# 1.0.0-rc.12

- Detailed immutable report sessions by default; `senten report start --short` retains the compact view.
- Every stopped session writes a unique timestamped JSON + Markdown pair without replacing historical reports.
- Detailed Markdown now includes record identity, environment/Git metadata, chronological command timestamps, per-command status/exit/duration, command-specific discovery/adoption/security/release evidence, final snapshots, and failure/interruption evidence.
- Added `senten report show`, `senten report compare`, `senten report export`, and safe `senten report prune` with dry-run-by-default retention cleanup.
- Report comparison surfaces readiness, semantic/operational coverage, discovery/cache performance, graph size, findings, and framework changes.
- Session record schema upgraded to v2 and captures lightweight command-result snapshots for later audit/comparison.

# Changelog

## 1.0.0-rc.11

- Added interactive discovery progress with phase, elapsed time, cache metrics, large-repository notice, and safe Ctrl+C cancellation.
- Added optional `--timeout`, `--stall-timeout`, and `--stall-warn` controls for discovery and adoption.
- Preserved completed file-cache objects after cancellation/timeouts so subsequent discovery reuses completed work.
- Session reports now distinguish CANCELLED/TIMED OUT/STALLED from failures and export richer discovery, capability, security, adoption, and release-check evidence.
- Added auto-named `senten report start` / `senten report stop` aliases.
- Expanded detection-level capability boundaries for Nuxt, NestJS, Python/Django/FastAPI, PHP/Laravel, and Ruby/Rails.
- Expanded default generated/cache directory exclusions for large repositories.
- Persist release-check details for report diagnosis.

# 1.0.0-rc.10 — Machine Contracts, Findings Interchange & Security Context

- Added `senten contract` with explicit machine-interface schema/version metadata and stable exit-code semantics for integrations and agents.
- Added normalized finding interchange (`senten.finding.v1`) with SARIF/JSON import, listing, inspection, filtering, clearing, and StateTruss attachment.
- Added first-class semantic `finding:*` nodes and `affects` edges so imported scanner results participate in `senten impact` blast-radius analysis.
- Added `senten security status|surface|boundaries|exposure` as architecture security context, deliberately separated from vulnerability scanning.
- Added `senten.security-context.v1` structured JSON output with explicit limitations: unknown never means safe/public.
- Added `senten report security` and `senten report findings` JSON/Markdown evidence exports.
- Kept security providers vendor-neutral so Opengrep/Semgrep/Aikido/CodeQL/Trivy/OSV/Gitleaks/ZAP/Astra-style integrations can normalize into the same finding contract.
- Preserved RC9 mixed-language truthfulness and lifecycle/reporting hardening.

# 1.0.0-rc.9

- Hardened framework detection with multi-file corroboration to reduce false positives.
- Added repository-wide source inventory and truthful modeled/unsupported coverage.
- Added Rails/Ruby detection-level intelligence and dependency-backed security signals.
- Added `senten capabilities`, `senten status`, `senten remove`, `senten purge`, and `senten reset`.
- Added `senten report session` aliases around dogfood recording/export.
- Preserved idempotent initialization and existing safe redo-all semantics.

# 1.0.0-rc.8 — Remote Repository & Secure Learning Candidate

- Added provider-neutral remote repository foundation with first-party GitHub read support.
- Added `senten repo inspect|tree|permissions` without requiring a local clone.
- Added `senten auth github status|login`; Senten never persists GitHub tokens in project state.
- `senten learn source` now uses GitHub tree/blob APIs instead of cloning repositories.
- External learning retains only compact metadata/knowledge artifacts; raw remote source is not persisted.
- Added remote-learning storage budgets, sensitive-file filters, provenance by commit/tree SHA, and `senten learn storage|prune`.
- Added compact framework/package/dependency knowledge extraction from manifests.
- Added regression tests proving remote learning retains no raw source tree.

# 1.0.0-rc.7 — Learning & Adapter Ecosystem Candidate

- Added `senten learn` project learning with evidence-backed candidates, confidence, human approval/rejection, and project-scoped memory promotion.
- Added reusable `knowledge-pack` package kind plus build/install flows.
- Added static-only public GitHub source ingestion with generic language/manifest inventory; no package installation or repository code execution.
- Formalized the release architecture: language/source analyzers parse syntax, framework/vendor adapters emit Application IR, knowledge packs carry versioned semantics, and project learning captures local/team conventions.
- Added `learning.manage` agent capability boundary.
- Preserved the rule that confidence is not evidence and learned candidates are not silently promoted to truth.

## 1.0.0-rc.6 — Public Release Hardening

- Make `senten init` idempotent: rerunning it on a healthy Senten project succeeds without overwriting configuration or requiring `--force`.
- Add explicit `--init` convenience bootstrapping for state-dependent commands such as `senten record start ... --init`.
- Replace raw stack traces for ordinary CLI usage errors with concise user-facing messages; set `SENTEN_DEBUG=1` to include stack traces.
- Add workspace-scoped semantic identity for monorepo routes and adapter-emitted actions/resources so identical paths in separate apps no longer collapse into one node.
- Model local workspace packages as `module:*` nodes and `uses-workspace-package` edges instead of misclassifying them as external providers.
- Attach workspace ownership metadata to files and scoped semantic nodes.
- Resolve the containing Git worktree from nested projects, allowing release checks and adoption analysis to see repository-level Git and CI state.
- Surface repository-root GitHub Actions to nested workspace projects.
- Surface framework and workspace signals in adoption reports, including Expo and Tauri discoveries.
- Refine framework detection for scaffold/template-generator repositories so supported templates are not reported as simultaneously active frameworks.
- Stop treating ordinary routes without recognized authentication as a security warning by default; policy recommendations now depend on detected auth, actions, or resources.
- Add RC6 regression coverage for monorepo route collisions, workspace dependencies, generator framework classification, init idempotence, and `--init` bootstrapping.

## 1.0.0-rc.5 — Recording Export Repair

- Fixes `senten record export --format md|json` so option values are not misread as recording IDs.
- Preserves export-by-record-ID behavior and default export of the latest completed recording.
- Adds regression coverage for the exact external-dogfood command sequence.

## 1.0.0-rc.5 — External Dogfood Hardening

- Canonicalize Next.js dynamic and catch-all routes so source intelligence and framework adapters converge on one semantic route identity.
- Prevent repeated rediscovery from duplicating adapter-generated edges or provenance records.
- Resolve project-root and common alias imports before classifying imports as external package providers, eliminating false providers such as `provider:package/app`.
- Add a first-party Drizzle ORM adapter that extracts table resources and inferred action read/write relationships.
- Refine security adoption semantics so detected authentication without Senten policy mapping is `detected-but-unmapped`, not falsely reported as a security failure.
- Reserve critical security adoption gaps for explicit evidence such as routes declared `security: unprotected`.
- Replace coarse semantic coverage with an explainable, applicability-aware coverage breakdown; `senten adopt --details` shows the contributing dimensions.
- Separate generic application release readiness from package/RC publishing hygiene; package metadata gates run under `--package` or `--rc`.
- Add `senten record` for structured dogfood/audit sessions with JSON persistence and human-readable Markdown export.
- Extend the trusted npm publish workflow with the stable `latest` channel while retaining OIDC provenance and the `npm-release` environment.
- Add regression fixtures derived from the first two external dogfood repositories.

## 1.0.0-rc.1 — Builds 26–30 Release Candidate Hardening

- added real-app Next.js + Supabase semantic discovery fixtures and first-party Supabase adapter;
- added Next route-handler HTTP actions and inferred Supabase resource access;
- added explainable blast-radius analysis to `senten impact`;
- hardened MCP against path traversal and client-side authority escalation;
- expanded monorepo adoption coverage including pnpm workspaces;
- added CLI/source version-alignment diagnostics to help detect stale global installs;
- candidate-froze command, extension and registry protocol markers as `1.0-rc1`;
- added `senten release check --rc` and npm/GHCR `rc` release channels;
- added RC verification documentation and retained Application IR as an independently versioned schema.

## 0.25.0-alpha.0

- Hardens Application IR fragment merging so same-kind adapter disagreements cannot silently overwrite the canonical semantic identity; conflicting metadata is preserved as diagnostics and provenance.
- Hardens MCP project scope with sensitive-path denial, external absolute-path denial, and credential/private-key redaction on tool output.
- Hardens Docker sandboxes with read-only root filesystems, tmpfs scratch space, no-new-privileges, dropped Linux capabilities, and explicit boundary reporting.
- Deepens existing-application adoption with workspace/package-manager detection, structured architecture/security/testing/operations gaps, readiness scoring, and strict-mode critical-gap failure.
- Adds a cross-platform hardening fixture suite for Builds 22–25.

## 0.21.1-alpha.0

- Harden Windows MCP stdio test lifecycle by waiting for child-process shutdown before temporary-directory cleanup.
- Add bounded retry cleanup for transient Windows `EBUSY`/locked-directory conditions.
- Preserve all Build 21 MCP permission and live-effect assertions without skips or platform-specific weakening.

# Changelog

## 0.21.0-alpha.0

- Formalized the versioned Application IR Fragment SPI for framework adapters.
- Added deterministic StateTruss fragment validation/merge with adapter provenance and collision diagnostics.
- Added first-party alpha IR adapters for Next.js, Expo, and Tauri.
- Added fail-closed sandbox mutation effect boundaries and explicit live-effect override semantics.
- Hardened mutating Playwright click-through probes behind an explicit live-effects gate.
- Added a real MCP stdio JSON-RPC transport with read-only default tool exposure, timeout/output limits, and shell-free execution.
- Added Build 21 hardening tests and protocol documentation.

## 0.20.0-alpha.0 — Builds 12–20 Capability Sprint

- completed the alpha release/distribution hardening lane and prepared npm Trusted Publishing;
- added `senten adopt` with safe existing-application architecture signals and adoption reports;
- added explicit `senten declare`, `senten relate`, and `senten why` semantic architecture operations;
- added provider-neutral capability registration, health selection, graceful-degradation state and operational budgets;
- expanded the first-party Git integration with persistent project-scoped identity bindings and mismatch diagnostics;
- added Git context to agent Task Context Bundles without copying credentials;
- added declarative safe failure-simulation plans that require isolated execution;
- retained signed extension/package trust, compatibility and registry boundaries as the ecosystem foundation;
- added Observatory adoption intelligence and `/api/adoption`;
- added `senten compatibility` as a machine-readable stabilization boundary for IR/protocol/state contracts;
- retained unknown-is-not-safe, evidence-before-AI and safe-by-simulation principles.

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

## 1.0.0-rc.2

- Added `senten.architecture.json` as a declarative architecture overlay for policies, invariants, and other semantic contracts.
- Added `.sentenignore` support so controlled fixtures and generated demo sources do not pollute production architecture discovery.
- Added the Senten self-model with security, agent, sandbox, registry, and evidence invariants.
- Added the controlled Scenario Lab corpus and `senten scenario` verification/export commands.
- Added `senten showcase build` and a static interactive showcase that renders real precomputed Senten analysis without executing visitor repositories.
- Added regression coverage for architecture manifests, scenario verification, showcase artifact generation, and ignore boundaries.

## 1.0.0-rc.16

### Actor awareness, activity, listen, and physical checkpoints

- Added optional local Senten user profiles with `senten user` and `senten whoami`.
- Reports now record execution identity provenance, machine label, local/remote session kind, and explicitly exclude IP/geolocation collection.
- Added project activity journal and canonical `senten activity export ...` syntax with time/user filters.
- Added `senten listen [path]` foreground recursive filesystem monitoring with add/modify/delete journaling and change summaries before the next Senten command.
- Reworked checkpoints into verified project-state copies under `.senten/checkpoints/` with create/list/show/diff/restore/rename/remove/doctor commands.
- Checkpoint restore is destructive-gated, creates a recovery checkpoint first, and shows restore progress.
- Added canonical `senten create checkpoint [name]` convenience alias while retaining `senten checkpoint create [name]` as the documented subsystem form.
- Expanded CLI grammar consistency around `senten <domain> <action> [target] [options]`.

## 1.0.0-rc.17

### Workspace reconciliation and workflow scope clarity

- Reworked `senten init` into an idempotent workspace reconciliation entry point for existing projects.
- Added `.senten/workspace.json` baseline metadata with initialized/reconciled Senten versions, workspace schema, and boilerplate version.
- Added `senten init --check` for non-mutating baseline inspection; returns a non-zero status when reconciliation is required.
- Existing projects now receive missing Senten-managed directories and missing project boilerplate workflows without overwriting modified or custom workflows.
- Locally modified boilerplates are preserved during `init` and surfaced with explicit `workflow diff` / `workflow reset` guidance.
- Fresh projects materialize the six starter workflows into `.senten/workflows/` and record their baseline.
- `senten status` now reports whether the workspace baseline is current or reconciliation is available.
- `senten workflow list` now groups effective workflows by Workspace / Project / Global / Built-in scope.
- Added scope-specific workflow listing with `--project`, `--global`, `--builtin`, and `--workspace <name>`; `--all` now marks definitions as ACTIVE or shadowed.
- Removed Node's `shell: true` version-probing path from environment detection to avoid DEP0190 argument-escaping warnings on Windows.

### Safety model

`senten init` treats missing baseline assets as additive reconciliation. It never overwrites user-owned/custom workflows. Modified boilerplates require the explicit destructive `senten workflow reset` path, which retains the existing backup-and-confirmation behavior.

## 1.0.0-rc.23

### Tool Fabric, AI context, adapter contract, and security capabilities

- Added the v1 Tool Fabric surface: `senten tool discover|list|inspect|resolve|register|doctor|run`.
- Added explicit tool activation with `senten use tool <name>` plus ergonomic invocation through `senten use <tool> <args...>`.
- Tool resolution remains project-local/registered/PATH based; Senten does not vendor or pin third-party CLIs.
- Added conservative high-risk classification for selected destructive Git/Docker/tool operations before execution.
- Added `senten ask ...` as an offline-first Markdown/JSON context interface for LLMs and agents, including optional context budgets and `--for-ai` policy checks.
- Added project AI capability policy commands: `senten ai permissions|grant|revoke`. AI-sensitive context is denied by default unless explicitly granted.
- Added security modes, lock state, TTY-only passphrase setup/unlock, scrypt-backed passphrase verification, temporary non-delegable capability leases, and secure-mode requirements.
- Expanded adapter manifests with explicit `namespace` and Senten compatibility range; validation rejects core namespace collisions.
- Added `senten adapter doctor` and `senten use adapter <name>` activation.
- Expanded the public extension SDK with Tool and Context provider contracts.
- Refined Windows `.cmd`/`.bat` invocation so quoting is owned by one final serialization layer using `windowsVerbatimArguments`.

### V1 boundary

RC23 intentionally does not implement OS-level ACL or filesystem encryption. Senten-governed AI/tool access is policy controlled; an external process already granted unrestricted OS permissions can bypass application-level controls. OS-level isolation, enterprise IAM, encrypted state vaults, and stronger platform-native authentication remain candidates for v1.1+.

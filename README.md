# Senten

**Architecture for Living Software.**

Senten is a framework-agnostic semantic application architecture framework for building, understanding, testing, securing, reusing, remembering, and safely evolving software across web, mobile, desktop, server, edge, and AI-agent environments.

Senten does **not** replace React, Vue, Next.js, Expo, Tauri, Git, PostgreSQL, Supabase, or other tools. It gives them a shared semantic layer: StateTruss, Universal Elements, policies, invariants, capabilities, evidence, safe operations, scoped memory, templates/blueprints, registries, sandboxing, interaction assurance, and machine-readable context.


## Source Intelligence

Build 2 lets Senten learn an existing TypeScript/JavaScript application without executing it:

```bash
senten discover
senten source status
senten graph
senten impact route:/api/projects
senten baseline accept
senten drift
```

Discovery is incremental and content-addressed. Framework adapters may contribute source analyzers, allowing ecosystems to teach Senten their semantics without hard-coding every framework into Senten Core. Manual StateTruss declarations are preserved during rediscovery.

## Workflow authoring

Workflows can now be built entirely from the CLI:

```bash
senten create workflow pre-release --empty
senten workflow add pre-release -- doctor
senten workflow add pre-release -- discover
senten workflow add pre-release -- drift --strict
senten workflow steps pre-release
senten workflow validate pre-release
senten workflow run pre-release --dry-run
```

Use `workflow remove`, `workflow move`, or `workflow clear` to safely reshape a local workflow. The standalone `--` separates Senten's workflow-builder options from the Senten command and arguments stored as the step.


## Current status

`0.11.0-alpha.0` is the Distribution & Release Engineering alpha. It adds cross-platform CI, npm packaging, an official Docker image definition, release artifacts/checksums/SBOMs, signed container publishing, and explicit alpha/beta/stable channels while preserving the Build 10.2 CLI hardening.

Implemented now includes:

- StateTruss semantic graph and Application IR
- Universal Elements and safe operation ledger with undo/redo
- scoped memory, profiles, templates, blueprints, packages, registries and workflows
- TypeScript/JavaScript Source Intelligence, semantic diff and architecture drift
- local/Docker sandbox providers, snapshots and deterministic replay
- dependency-free HTTP crawl and navigation graph discovery
- Playwright-backed browser clickthrough when Playwright is installed
- guarded interaction probing and null-interaction findings
- deterministic critical user journeys
- persistent interaction runs/nodes/edges/findings in SQLite
- runtime interaction evidence linked back into StateTruss routes
- durable runtime observations/traces and runtime-vs-StateTruss alignment
- explicit evidence ladder: declared → observed → tested → verified
- evidence-backed `senten guarantee` and `senten proof`
- runtime/evidence sinks for application instrumentation
- Extension Protocol + React/Git/LaunchProof examples
- canonical project intelligence snapshot and report ledger
- JSON/Markdown/self-contained printable HTML reports
- local-first, read-only Senten Observatory
- decentralized HTTP registries, package signatures, publisher trust and compatibility contracts
- Senten Assurance Exchange v0.1 and native LaunchProof verification interchange
- first-class Assurance Cases with trusted independent verification provenance

Architecturally committed and staged for later builds: responsive/device matrices, native mobile/desktop interaction drivers, richer interactive Observatory graph/timelines, native PDF renderer, full MCP/A2A transports, OpenTelemetry/runtime collectors, and v1 security/performance/release hardening.

## Interaction Assurance

Fast route/link discovery requires no browser dependency:

```bash
senten crawl http://localhost:3000
senten paths
```

For rendered browser interaction analysis, install Playwright in the Senten development repository and one or more browser runtimes:

```bash
npm install -D playwright
npx playwright install chromium

senten clickthru http://localhost:3000 --browser chromium
```

By default clickthrough avoids probing controls that look destructive or externally effectful. Against an isolated sandbox/test application, deliberate broader probing is available with `--include-actions`.

Critical flows can be represented as deterministic journeys:

```bash
senten journey create checkout http://localhost:3000
senten journey inspect checkout
senten journey run checkout --browser chromium
senten journey history
```

Interaction results are persisted in the Local State Layer and produce StateTruss evidence nodes so future proof/reporting systems can correlate declared routes with observed runtime behavior.

## Runtime state and evidence

Record or ingest runtime observations without executing untrusted project code during static analysis:

```bash
senten runtime status
senten runtime observe invariant:tenant-isolation --kind invariant --status passed
senten runtime ingest runtime.jsonl --env test
senten runtime traces
senten runtime alignment
```

Inspect accumulated evidence and evaluate guarantees:

```bash
senten evidence summary
senten evidence summary invariant:tenant-isolation
senten guarantee invariant:tenant-isolation
senten proof
```

Senten intentionally distinguishes **declared**, **observed**, **tested**, and **verified** evidence. A successful runtime observation is not automatically treated as independent verification, and missing evidence never means passed.


## LaunchProof independent assurance

Export StateTruss-bound claims and supporting evidence for independent LaunchProof analysis:

```bash
senten assurance claims
senten launchproof export
senten launchproof export --subject invariant:tenant-isolation
```

Import a LaunchProof verification result:

```bash
senten launchproof import launchproof-result.json
senten launchproof status
```

Senten verifies that the result is bound to the exact exported assurance bundle and claim subjects. A trusted Ed25519-signed LaunchProof result can create strength-4 `verified` evidence. Unsigned or untrusted-but-valid results are deliberately downgraded to `tested` evidence so Senten cannot confuse an unauthenticated assertion with independent verification.

Group claims into an Assurance Case:

```bash
senten assurance case create tenant-boundary \
  --claim invariant:tenant-isolation
senten assurance case evaluate tenant-boundary
senten report assurance --format html
```

Manual `senten evidence add --status verified` is rejected. Independent verification must enter through a verifier integration.

## Observatory and reports

Generate portable project intelligence artifacts from the same canonical snapshot used by the GUI:

```bash
senten report project --format html
senten report architecture --format md
senten report evidence --format json --output evidence.json
senten report list
```

Launch the local workbench:

```bash
senten observatory
# or open the browser automatically
senten observatory --open
```

Observatory binds to `127.0.0.1` by default and is read-only in Build 7. Non-loopback exposure requires the explicit `--allow-remote` flag.

## Requirements

- Node.js `>=22.5`

The project currently uses Node's built-in SQLite API for the default local durable store.

## Installation

During repository development:

```bash
npm install
npm run preflight
npm link
```

The public-alpha distribution is prepared for:

```bash
# project-local / CI
npm install -D senten@alpha
npx senten --version

# global workstation CLI
npm install -g senten@alpha
senten --version
```

Docker releases are designed for GHCR:

```text
ghcr.io/thomasdscx/senten:alpha
```

See `docs/SENTEN_DISTRIBUTION_v0.1.md` for Windows CMD, PowerShell, macOS/Linux, Docker and release-channel details.

## Quick start

```bash
senten init
senten doctor
senten discover
senten inspect
```

Friendly creation aliases coexist with canonical domain-first commands:

```bash
senten create sandbox
# canonical equivalent
senten sandbox create
```

## Safe changes and history

```bash
senten create file notes.md
senten element README.md copy ./tmp/ --dry-run
senten element README.md copy ./tmp/
senten history
senten undo
senten redo
```

Batch rollback previews first:

```bash
senten undo all --today
senten undo all --today --apply
```

Group work and create rollback boundaries:

```bash
senten session start "billing refactor"
senten transaction start "move billing domain"
# ...Senten operations...
senten transaction end
senten session end

senten checkpoint create before-auth
senten rollback checkpoint:cp_123
senten rollback checkpoint:cp_123 --apply
```

## Memory and profiles

```bash
senten memory add decision database "Use PostgreSQL for transactional state"
senten memory add rule validation "Validate all external input"
senten recall database

senten profile create team-standard --package-manager pnpm
senten profile use team-standard
```

Senten memory is typed, scoped, sourced, and inspectable. It is designed to let new developers and new LLM/agent models learn project decisions and rules without repeatedly rediscovering the repository.

## Templates and blueprints

Create a reusable implementation template from the current project:

```bash
senten create template my-saas
```

Create a reusable semantic architecture blueprint:

```bash
senten create blueprint multi-tenant-saas
```

Inspect and reuse packages:

```bash
senten template list
senten template inspect my-saas
senten use template my-saas
```

Extension namespaces may register their own templates:

```bash
senten template list
senten react templates
# future package-backed adapter generators:
senten init template react basic
```

The command grammar is already reserved; package-backed generators are progressively implemented by adapters rather than hard-coded into Senten Core.

## Registries

Senten's registry model is decentralized. Build 1.5 implements local/filesystem registries and a common package envelope.

```bash
senten registry list
senten registry add team ../team-registry
senten registry search dashboard
senten package verify .senten/packages/template-my-saas
senten registry publish .senten/packages/template-my-saas --to team
```

Package kinds include adapters, integrations, templates, blueprints, profiles, skills, providers, policy packs, and journeys.

## CLI model

```text
senten <domain> <action> <target> [selectors] [flags]
```

The CLI, future MCP interface, and Observatory are intended to resolve through one command/semantic registry rather than implementing separate logic.

## StateTruss

StateTruss is Senten's structural model for connecting resources, actions, state, contracts, policies, invariants, capabilities, effects, interactions, evidence, decisions, and runtime behavior.

Senten's long-term loop is:

```text
Intent
  ↓
Decision
  ↓
Blueprint
  ↓
StateTruss
  ↓
Implementation
  ↓
Verification
  ↓
Runtime
  ↓
Evidence
  ↓
Memory
  └────────→ Architecture
```

## Extensions

Senten keeps the core small. Framework ecosystems teach Senten through adapters; tools and services connect through integrations.

```text
Senten Core
  └─ Extension Protocol
      ├─ Adapters
      │   ├─ React
      │   ├─ Vue
      │   ├─ Expo
      │   └─ ...community maintained
      └─ Integrations
          ├─ Git
          ├─ LaunchProof
          ├─ Supabase
          └─ ...community maintained
```

Extensions may register commands, semantic types, detectors, lifecycle hooks, element types, templates, blueprints, skills, providers, and later interaction drivers/generators.

## LaunchProof

Senten and LaunchProof remain intentionally complementary:

- **Senten** defines semantic architecture, intent, policies, invariants, structured evidence, and project memory.
- **LaunchProof** independently evaluates whether implementation/runtime evidence supports those claims and whether software is actually ready to ship.

Senten must never treat a self-declared guarantee as externally verified simply because Senten generated the declaration.

## Repository layout

```text
packages/
  core/
  semantic/
  contracts/
  security/
  runtime/
  local-state/
  memory/
  templates/
  registry/
  extension-sdk/
  sandbox/
  cli/
adapters/
  react/
integrations/
  git/
  launchproof/
apps/
  observatory/
examples/
  reference-app/
docs/
```

## Documentation

- `docs/SENTEN_PRD_v0.4.md`
- `docs/SENTEN_ARCHITECTURE_v0.3.md`
- `docs/SENTEN_CLI_SPEC_v0.2.md`
- `docs/SENTEN_REGISTRY_PROTOCOL_v0.1.md`
- `docs/SENTEN_LOCAL_STATE_v0.1.md`
- `docs/BUILD_STATUS.md`

## Security posture

Senten treats repositories, plugins, agents, packages, and external effects as potentially untrusted. Build 1.5 adds integrity-verifiable packages, automatic secret exclusion during template extraction, append-only provenance, conservative rollback preconditions, project-root path protection, dry-run behavior, and preview-first batch rollback.

The full threat model continues with the hardened Sandbox and package-signing builds.

## License

Apache-2.0.


## Safe command workflows

Senten can save deterministic command sequences as reusable workflows for humans, agents, templates, profiles, and teams.

```bash
senten create workflow pre-release
senten workflow run pre-release --dry-run
senten workflow run pre-release
senten workflow history
```

Workflows execute Senten commands through the same safety and history layers used by interactive CLI operations. Workflow packages can be shared through Senten registries.

Batch reversal is symmetrical and preview-first:

```bash
senten undo all --today
senten undo all --today --apply
senten redo all
senten redo all --apply
```

## Build 3 — hardened sandboxes

Senten now supports persistent disposable execution environments:

```bash
senten sandbox providers
senten sandbox create
senten sandbox create --provider docker --network deny --ttl 2h
senten sandbox run <id> -- npm test
senten sandbox snapshot <id> before-migration
senten sandbox restore <id> <snapshot-id>
senten sandbox reproduce <run-id>
senten sandbox simulate-install <package>
senten sandbox destroy <id>
```

The default `local` provider is a sanitized workspace copy intended for reproducibility and safe iteration. It intentionally refuses to claim enforceable network denial. Use the optional Docker provider for container isolation, `--network none`, and CPU/memory/PID limits when executing untrusted code.

Repository `.env*`, `.git`, `.senten`, common credential/private-key files, dependency folders and build output are excluded from sandbox copies. Synthetic secrets can be provisioned explicitly with `--synthetic-secret NAME`.


## Agent Intelligence

Build 5 introduces bounded agent identities, explicit capability grants, compact Task Context Bundles, durable agent-run provenance, Change Bundles, and an MCP-facing tool schema foundation.

```bash
senten agent create codex --provider openai --model codex
senten agent grant codex project.read
senten context --task "understand billing" --agent codex
senten agent run codex --task "inspect architecture" -- inspect
senten agent history codex
senten commands --format json
senten mcp schema
```


## Extension ecosystem hardening (Build 8)

Senten now supports decentralized local and HTTP registries, package compatibility contracts, SHA-256 integrity, Ed25519 publisher signatures, local trust anchors and extension validation.

```bash
senten registry add community https://registry.example.com
senten registry search react
senten registry fetch community/example-template

senten trust keygen --publisher my-team
senten package sign .senten/packages/template-demo --key .senten/keys/my-team.private.pem --publisher my-team
senten trust add my-team.public.pem --publisher my-team
senten package verify .senten/packages/template-demo

senten extensions inspect react
senten extensions validate react
```

Integrity, publisher trust and runtime compatibility are deliberately separate checks. Downloading a package does not execute it, and untrusted remote packages are rejected by default.


## Release readiness

Before publishing or cutting a release candidate, run:

```bash
npm run preflight
senten doctor --strict
senten release check --strict
senten benchmark --iterations 20
```

Senten remains pre-1.0; Build 10 hardens the project for public inspection without claiming final API stability.


## Runtime support

Node.js 22.5+ is the canonical Senten runtime for the alpha. Bun is an experimental compatibility target. Docker distributions include their own runtime. See `docs/RUNTIME_SUPPORT.md`.

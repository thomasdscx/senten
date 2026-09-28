# Senten

**Architecture for Living Software.

### Release candidate 1.0.0-rc.6

RC6 hardens existing-app adoption before the stable 1.0 release: idempotent initialization, explicit `--init` bootstrapping, workspace-scoped monorepo semantics, local workspace dependency modeling, ancestor Git/CI awareness, and safer framework/security classification.
**

Senten is a framework-agnostic semantic application architecture framework for building, understanding, testing, securing, reusing, remembering, and safely evolving software across web, mobile, desktop, server, edge, and AI-agent environments.

Senten does **not** replace React, Vue, Next.js, Expo, Tauri, Git, PostgreSQL, Supabase, or other tools. It gives them a shared semantic layer: StateTruss, Universal Elements, policies, invariants, capabilities, evidence, safe operations, scoped memory, templates/blueprints, registries, sandboxing, interaction assurance, and machine-readable context.



## Existing-app adoption and living architecture

Adopt an existing project without executing repository code:

```bash
senten adopt
senten why route:/api/projects
```

Declare architecture that cannot be inferred safely from source alone:

```bash
senten declare resource invoice
senten declare action invoice.create
senten relate action:invoice.create writes resource:invoice
```

Provider-neutral capability configuration and operational budgets:

```bash
senten capability register ai local-ollama --priority 100
senten capability budget ai --latency-ms 5000 --tokens 12000
senten capability check ai --latency-ms 900 --tokens 2500
```

Project-scoped Git context can be bound without storing Git credentials:

```bash
senten git bind ThomasDSCX --remote origin --permission read --permission commit
senten git context
senten git doctor
```

See `docs/SENTEN_BUILDS_12_20.md` for the cumulative sprint map and implemented boundaries.

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

`1.0.0-rc.1` is the first release-candidate line. It adds real-application dogfood fixtures, richer Next.js/Supabase semantics, explainable blast-radius intelligence, adversarial MCP scope hardening, monorepo adoption coverage, RC protocol markers, and release-candidate distribution gates.

Earlier `0.21.x` builds established versioned Application IR fragments, first-party Next.js/Expo/Tauri adapters, fail-closed mutation effect boundaries, and the read-only-by-default MCP stdio transport.

`0.20.0-alpha.0` was the cumulative Builds 12–20 capability sprint. It keeps the proven distribution/release foundation and deepens existing-app adoption, explicit StateTruss contracts, provider-neutral capabilities/budgets, project-scoped Git context, safe failure simulation, Observatory adoption intelligence, and compatibility reporting. The v1 public contracts are intentionally not frozen yet.

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

Architecturally committed beyond RC1: native mobile/desktop interaction drivers, richer interactive Observatory graph/timelines, native PDF rendering, A2A transport, broader OpenTelemetry/runtime collectors, deeper framework adapters, and continued security/performance hardening.

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

The release-candidate distribution is prepared for:

```bash
# project-local / CI
npm install -D senten@rc
npx senten --version

# global workstation CLI
npm install -g senten@rc
senten --version
```

Docker releases are designed for GHCR:

```text
ghcr.io/thomasdscx/senten:rc
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

## Learning and knowledge packs

Senten 1.0 introduces an evidence-backed learning layer. `senten learn` studies the current project, proposes conventions and mappings, and keeps them as candidates until a human approves them. Confidence is not evidence and learning is never silently promoted to truth.

```bash
senten learn
senten learn candidates
senten learn approve <candidate-id>
senten learn package --name my-team-platform
senten learn install .senten/learn/packages/my-team-platform
```

External source learning is static-only by default and currently accepts public GitHub repositories:

```bash
senten learn source https://github.com/facebook/react --ref v19.1.0
```

Senten performs a shallow fetch and inventory only. It does not run package installers, lifecycle scripts, or repository code. Language analyzers explain syntax; framework/vendor adapters map technology-specific behavior into Application IR; knowledge packs add versioned semantic knowledge; project learning captures team-specific conventions.

Knowledge packs are ordinary signed/verifiable Senten packages with kind `knowledge-pack`, so teams can keep them local, publish them to a private registry, or share public packs without modifying Senten Core.

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
senten sandbox run <id> --include-actions -- npm test
senten sandbox snapshot <id> before-migration
senten sandbox restore <id> <snapshot-id>
senten sandbox reproduce <run-id>
senten sandbox simulate-install <package>
senten sandbox destroy <id>
```

The default `local` provider is a sanitized workspace copy intended for reproducibility and safe iteration. It intentionally refuses to claim enforceable network denial. Use the optional Docker provider for container isolation, `--network none`, and CPU/memory/PID limits when executing untrusted code.

Build 21 adds an explicit effect firewall for mutation-capable sandbox runs. `--include-actions` fails closed unless the sandbox has Docker network denial, or the operator separately opts into `--allow-live-effects`. The latter is an explicit unsafe/live-effects override, not a containment claim, and is recorded in the sandbox run ledger.

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
senten mcp serve
senten mcp serve --allow-write
```

The MCP stdio server is read-only by default. Mutating tools require `--allow-write`; commands requesting live external effects require the additional `--allow-live-effects` server gate. Tool execution is shell-free, bounded by timeout/output limits, and receives a sanitized environment rather than inheriting arbitrary process secrets.



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
senten release check --rc --strict
senten benchmark --iterations 20
```

Senten is now on the `1.0.0-rc.1` line. RC protocol markers are candidate-frozen for compatibility testing; stable `1.0.0` remains gated on cross-platform CI, public-package verification, broader dogfooding, and release evidence.


## Runtime support

Node.js 22.5+ is the canonical Senten runtime for RC1. Bun is an experimental compatibility target. Docker distributions include their own runtime. See `docs/RUNTIME_SUPPORT.md`.


## Dogfood and audit recording

Senten can persist a structured execution record while you evaluate a project:

```bash
senten record start dogfood-project
senten discover
senten adopt --details
senten compatibility
senten record stop
senten record export --format md
```

The resulting Markdown/JSON record lives in `.senten/records/` and contains command outcomes plus the final adoption snapshot. See `docs/SENTEN_RECORDING.md`.

## Remote repositories and secure learning

Senten can inspect and learn from GitHub repositories without cloning them into your project:

```bash
senten auth github login
senten repo inspect owner/repository
senten learn source owner/repository
senten learn storage
```

Remote learning is static-only by default. Senten reads repository metadata, tree entries, and a bounded set of relevant text blobs through the GitHub API; it does not run package installs, lifecycle scripts, builds, or repository code. Raw remote source is not retained after analysis. The persistent artifact stores compact language/manifest inventory, package/framework/dependency knowledge, hashes, commit/tree provenance, and storage limits. Tokens are sourced from GitHub CLI credentials or process environment variables and are not written into project configuration, `.senten` state, SQLite, or knowledge packs.

See `docs/REMOTE_REPOSITORIES_AND_LEARNING.md` for the security and storage model.

## RC9 lifecycle and truthfulness hardening

Senten 1.0.0-rc.9 adds explicit repository-understanding boundaries for mixed-language applications. Adoption reports now distinguish repository-wide source inventory from semantically modeled source, and surface unsupported/unmodeled files instead of treating unknown code as passed coverage.

New operational commands:

```bash
senten status
senten capabilities
senten report session start dogfood
senten report session stop
senten purge --dry-run
senten purge
senten reset
senten remove --dry-run
senten remove
```

`purge` removes generated `.senten/` state while preserving `senten.config.json`. `reset` recreates fresh local state using the existing configuration. `remove` removes Senten project state and configuration while preserving application source, `senten.architecture.json`, and Git history.

Framework signals now require stronger corroboration to reduce false positives. Rails/Ruby repositories are detected explicitly as detection-level support until full semantic adapters are available, including dependency-backed security signals such as Devise and Pundit.

## RC10: Machine contracts, findings, and security context

RC10 keeps Senten provider-neutral while making it easier for IDEs, agents, CI systems, internal developer platforms, security tools, LaunchProof, and LobeWork to build on stable machine-readable contracts.

```bash
senten contract
senten contract --json
```

External scanner findings can be normalized from SARIF or generic JSON into `senten.finding.v1` and attached to StateTruss:

```bash
senten finding import opengrep.sarif --provider opengrep
senten findings
senten finding <id>
senten impact finding:<id>
```

Senten does not claim to replace a SAST/DAST/SCA or penetration-testing engine. It supplies architectural context around evidence produced by those tools:

```bash
senten security status
senten security surface
senten security boundaries
senten security exposure
senten security status --json
```

Security context uses the versioned `senten.security-context.v1` contract. Unknown route protection remains **unknown**; Senten never converts missing evidence into a pass.

Evidence-oriented exports are available for other tools such as LaunchProof:

```bash
senten report security --format json
senten report security --format md
senten report findings --format json
senten report findings --format md
```

The intended integration model is: scanners discover candidate findings, Senten maps them onto application architecture and blast radius, and assurance tools such as LaunchProof evaluate evidence and release policy.


## RC11 large-repository hardening

Long-running discovery emits live terminal progress when attached to a TTY and tracks the entire discovery lifecycle: workspace detection → framework detection → repository inventory → cache/parsing → semantic graph → discovery manifest → StateTruss persistence → state metadata → finalization. Current-phase progress and overall command progress are shown separately so a completed graph phase is never mistaken for a completed command. Large repositories receive a clear notice that full discovery may take several minutes. Completed cache work is preserved on cancellation, and explicit budgets such as `senten discover --timeout 10m`, `senten discover --stall-timeout 2m`, and `senten discover --stall-warn 30s` remain available.

Warm discovery also records whether the persisted StateTruss graph was unchanged and reused. Detailed reports include per-phase timings, cache metrics, graph reuse, framework understanding boundaries (detected / modeled / detection-only), and security-context wording that distinguishes architectural evidence from proven authentication or authorization controls. Use `senten report start` and `senten report stop` for auto-named detailed verification sessions.

## RC14 workflow, environment, adapter, and safety hardening

RC14 turns Senten workflows into local, editable project playbooks and adds a local-environment execution layer.

Project workflows live in `.senten/workflows/` as Markdown with front matter plus a `senten-workflow` fenced block. Senten discovers them automatically, so teams can copy/edit workflows directly in VS Code without registering them through the CLI.

```bash
senten workflow list
senten workflow templates
senten workflow create my-quality --from quality
senten workflow validate my-quality
senten workflow plan my-quality
senten workflow run my-quality
senten workflow doctor
senten workflow diff quality
senten workflow reset --dry-run
senten workflow reset
```

Built-in starter workflows include `smoke`, `quality`, `release-check`, `architecture-check`, `security-context`, and `full-assurance`. `workflow reset` restores only official boilerplates, backs up modified built-ins, and never changes custom workflows. Destructive operations require an interactive `[y/N]` confirmation unless `--yes` is explicitly supplied for automation; `--dry-run` previews where supported.

Senten can now inspect the local toolchain without installing project dependencies:

```bash
senten environment
senten environment --json
senten plan run test
senten run test
senten run build --dry-run
senten native node --version
```

Universal `senten run` operations resolve project-native commands from package scripts and known framework conventions rather than reimplementing npm, pnpm, Laravel, Rails, Django, or other ecosystems.

Local adapters can be scaffolded and progressively deepened:

```bash
senten adapter create acme
senten adapter validate acme
senten adapter enable acme
senten adapter list
```

Adapter execution is explicit because local adapters can run code during discovery. Enabled local adapters can contribute source-analysis evidence and can declare namespaced native commands in `senten.adapter.json`. Project workflow resolution is `project -> user -> built-in`.

Warm discovery now caches the semantic graph using source/workspace/framework/adapter fingerprints and the graph builder uses set-based identity tracking instead of repeated linear lookups. This substantially reduces redundant graph work on unchanged repositories while preserving phase-level progress and evidence.

Workflow scope can also be user-global:

```bash
senten workflow create my-standard --from quality --global
```

Workflow resolution is deterministic: project-local first, then user-global, then canonical built-ins. Adapter authors can run `senten adapter test <name>` for basic conformance/determinism checks before enabling an adapter.

## Layered scopes and explicit invocation

Senten resolves developer resources predictably across `workspace → project → global → built-in` scope. Use `senten scope` to inspect active locations, `senten resolve workflow quality --all` to see all definitions, and `senten call workflow quality --global` (or `-g`) to deliberately invoke a shadowed global workflow from inside a project.

Project workflows live in `.senten/workflows/`; global workflows live in `~/.senten/workflows/`; optional workspace-specific workflows live in `.senten/workspaces/<name>/workflows/`. Adapters use the same project/global principle with explicit trust before executable adapter code is enabled. `senten config effective` explains layered settings and their sources.

## RC16: actor-aware activity and recoverable checkpoints

Senten keeps project history local and intentionally avoids invasive telemetry. `senten whoami` reports the active Senten profile when one is set, the operating-system account used as fallback attribution, the machine hostname, and whether the session appears local, SSH, or RDP. Senten does not collect IP addresses or geolocation for this feature.

Canonical project-history commands include:

```sh
senten user create errol
senten user use errol
senten whoami

senten activity --last 2h
senten activity --today
senten activity export --yesterday
senten activity export --last 5h --user errol --format md

senten listen
senten listen apps
senten listen apps/studio
senten listen --all

senten checkpoint create before-refactor
senten checkpoint list
senten checkpoint show before-refactor
senten checkpoint diff before-refactor
senten checkpoint restore before-refactor --dry-run
senten checkpoint restore before-refactor
senten checkpoint doctor
```

`senten listen` is recursive by default and uses Senten's normal generated/vendor exclusions. `--all` includes normally excluded content. File change events are journaled under `.senten/activity/`, and the next ordinary Senten command can surface that changes occurred since the previous Senten command.

Physical checkpoints are stored under `.senten/checkpoints/`. Standard checkpoints exclude regenerable directories such as `.git`, `node_modules`, build outputs, caches, coverage, and prior checkpoints. Restores require confirmation unless `--yes` is supplied and create a pre-restore recovery checkpoint before changing project files.

Senten's canonical CLI grammar is:

```text
senten <domain> <action> [target] [options]
```

Convenience verbs such as `senten create checkpoint` remain available, but documentation, automation, and reports use subsystem-first commands such as `senten checkpoint create` and `senten activity export`.

## Version-aware project initialization

`senten init` is idempotent. On an existing Senten project it reconciles the project with the current safe baseline instead of reinstalling or replacing user-owned state.

```bash
senten init --check   # preview missing/outdated baseline assets; changes nothing
senten init           # show the reconciliation plan and apply safe additive changes after confirmation
senten init --repair  # safe repair/reconciliation mode for damaged Senten-managed baseline state
```

Fresh projects receive human-readable starter workflows under `.senten/workflows/`. Existing custom workflows and locally modified boilerplates are preserved. Use `senten workflow diff <name>` to review a modified boilerplate and `senten workflow reset <name>` when you intentionally want the canonical Senten copy restored.

Workflow scope is explicit:

```bash
senten workflow list              # effective workflows grouped by scope
senten workflow list --project    # only repository-owned workflows
senten workflow list --global     # only user-global workflows
senten workflow list --builtin    # canonical Senten distribution workflows
senten workflow list --all        # all definitions, including shadowed copies and source paths
```

## Senten v1: tools, adapters, and AI context

Senten is designed to work with the frameworks and tools already present in a project rather than replace them.

```bash
senten tool discover
senten use tool docker
senten use docker compose up
senten use git status
```

Tools provide operational capability. Adapters add semantic understanding:

```bash
senten adapter create vue-mobile-apps
senten adapter validate vue-mobile-apps
senten adapter doctor vue-mobile-apps
senten use adapter vue-mobile-apps
```

LLMs and agents can request compact, model-agnostic project context without requiring Senten to call a hosted AI provider:

```bash
senten ask project
senten ask project frameworks
senten ask project --format json
senten ask project --budget 4000
```

Senten remains offline-capable. `senten ask` assembles context from Senten's local application model and excludes credentials and protected internal state by default.

Security authority remains human-owned:

```bash
senten security passphrase set
senten security mode secure
senten security unlock workflows --ttl 15m
senten ai permissions
senten ai grant read --scope "src/**" --ttl 30m
```

Human security leases are temporary and non-delegable. AI capabilities are independent of human unlock state, and destructive operations remain gated.


## AI, MCP, and provider-neutral context

Senten remains useful without any AI model. `senten ask` assembles deterministic project context from Senten's own model.

```bash
senten ask project architecture
senten ask project --format json --budget 4000
```

Discover local providers without uploading project data:

```bash
senten ai discover
senten ai models ollama
senten ai use ollama <model>
```

Any OpenAI-compatible endpoint can be registered without hard-coding a vendor into Senten Core:

```bash
senten ai provider add internal-ai --endpoint http://127.0.0.1:9000/v1 --protocol openai-compatible
senten ai use internal-ai <model>
senten ai ask "Explain this architecture"
```

Hosted credentials should be supplied through an environment variable reference using `--api-key-env`; Senten does not persist the plaintext key in project configuration. MCP clients can consume Senten context through `senten mcp serve`; AI-facing `ask` requests still pass through Senten's disclosure policy.

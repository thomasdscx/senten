# Senten — Product Requirements Document v0.3

**Status:** Working specification  
**Category:** Framework-agnostic application architecture / developer infrastructure  
**Primary implementation language:** TypeScript  
**Long-term target:** Language-neutral semantic platform  
**Tagline:** **Architecture for Living Software.**

## 1. Product Definition

Senten is a framework-agnostic semantic application architecture layer for building, understanding, testing, evolving, securing, and operating software across web, mobile, desktop, server, edge, workers, extensions, and AI-agent environments.

Senten does not replace React, Vue, Next.js, Expo, Tauri, Django, Rails, PostgreSQL, Supabase, Cloudflare, Git, or other established technologies. It provides the semantic, policy, capability, evidence, interaction, sandbox, and machine-readable architecture that connects them.

The central thesis is:

> Code should not be the only representation from which humans and machines must infer what a software system means.

Senten turns application meaning into an explicit, machine-readable, enforceable architecture.

## 2. Core Philosophy

Senten follows a closed development loop:

**Intent → Semantic Architecture → Impact Analysis → Implementation → Verification → Runtime Observation → Evidence → Architecture**

This enables **Living Software**: systems that can explain what they are, how they work, what changed, what must remain true, and what evidence supports their guarantees.

## 3. Core Concepts

### 3.1 StateTruss

StateTruss is Senten's structural application model. It connects state, contracts, policies, invariants, capabilities, effects, runtime behavior, interactions, and evidence across all application surfaces.

### 3.2 Universal Elements

Every addressable item in a Senten application is represented as a Universal Element.

Examples:

- `file:src/auth/session.ts`
- `dir:src/components`
- `component:CheckoutButton`
- `route:/checkout`
- `resource:Project`
- `action:project.create`
- `policy:project.delete`
- `feature:billing`
- `asset:brand.logo`
- `test:checkout.primary`
- `provider:email`

Human-friendly CLI syntax may omit the type when unambiguous.

### 3.3 Application Semantic Graph

The Application Semantic Graph represents the system's meaning, including:

- applications;
- features;
- resources;
- actors;
- actions;
- queries;
- events;
- workflows;
- policies;
- invariants;
- capabilities;
- effects;
- state;
- data;
- UI surfaces;
- tests;
- evidence;
- providers;
- owners;
- dependencies;
- decisions.

### 3.4 Application IR

Senten's TypeScript APIs compile into a language-neutral Application Intermediate Representation. The IR is the long-term compatibility boundary and may later support Rust, Python, Go, Swift, Kotlin, Dart, and other ecosystems.

## 4. Engine Architecture

Senten currently defines eleven logical engines:

1. **Semantic Engine** — semantic graph and application meaning.
2. **Contract Engine** — schemas, validation, compatibility, evolution.
3. **Policy Engine** — authentication, authorization, tenant isolation, purpose-aware access, agent permissions.
4. **Invariant Engine** — truths and guarantees that must remain valid.
5. **Capability Runtime** — provider-neutral access to database, AI, storage, email, payments, queues, search, browser, etc.
6. **Execution Engine** — actions, effects, transactions, idempotency, retries, compensation, workflows.
7. **State Engine** — local/cloud state, sync, realtime, offline, conflict resolution, CRDT adapters.
8. **Evidence Engine** — tests, traces, provenance, observations, assurance evidence.
9. **Intelligence Engine** — impact analysis, context bundles, agent tools, semantic compression, recommendations.
10. **Interaction Engine** — crawl, clickthrough, journeys, dead-end detection, responsive/device interaction assurance.
11. **Sandbox Engine** — isolated execution, ephemeral environments, branch/agent sandboxes, migration simulation, package observation, production-like test environments.

These are logical responsibilities, not marketing constraints; new engines may be added when architecturally justified.

## 5. CLI Design

Senten uses a hierarchical semantic CLI:

```bash
senten <domain> <action> <target> [selectors] [flags]
```

Primary commands include:

```bash
senten init
senten adopt
senten dev
senten run
senten state
senten policy
senten check
senten proof
senten inspect
senten explain
senten why
senten graph
senten impact
senten drift
senten crawl
senten clickthru
senten journey
senten sandbox
senten simulate
senten replay
senten report
senten context
senten agent
senten observatory
senten element
senten history
senten undo
```

Commands accept common selectors such as:

- `--env`
- `--surface`
- `--actor`
- `--resource`
- `--feature`
- `--since`
- `--until`
- `--severity`
- `--format`
- `--output`
- `--compare`
- `--include`
- `--exclude`
- `--where`
- `--json`
- `--quiet`
- `--verbose`

## 6. Universal Element Operations

Senten provides architecture-aware manipulation of files and semantic objects.

Examples:

```bash
senten element page.html copy ./backup/
senten element logo.png move ./assets/branding/
senten element Hero.tsx rename HeroSection.tsx
senten element src/auth/session.ts delete --dry-run
senten element action:invoice.create inspect
```

Element operations should support:

- copy;
- move;
- rename;
- clone;
- delete;
- inspect;
- trace;
- refactor;
- dependency-aware transfer;
- safe rollback.

Operations are impact-aware and may update imports, references, manifests, semantic locations, tests, and metadata.

## 7. Action History and Undo

Every Senten-mediated mutation creates a durable operation record containing:

- actor;
- intent;
- targets;
- impact;
- permissions;
- environment;
- resulting diff;
- verification;
- rollback recipe;
- evidence.

Commands:

```bash
senten history
senten undo
senten undo <operation-id>
```

Undo must reason about whether reversal remains safe rather than blindly applying inverse text edits.

## 8. Extension Protocol

Senten must remain lightweight and ecosystem-neutral. It therefore defines a native Extension Protocol rather than hard-coding every framework or service.

Two primary extension categories are defined:

### 8.1 Adapters

Adapters teach Senten how to understand a framework/runtime ecosystem.

Examples:

- React;
- Vue;
- Next.js;
- Expo;
- Tauri;
- Svelte;
- Angular;
- Flutter;
- Django;
- Rails.

Adapters may register:

- semantic types;
- parsers/analyzers;
- commands;
- detectors;
- interaction knowledge;
- state concepts;
- runtime boundaries;
- CLI subgrammars;
- Observatory views;
- MCP tools.

### 8.2 Integrations

Integrations connect Senten to external tools or providers.

Examples:

- Git;
- GitHub;
- Supabase;
- Cloudflare;
- Stripe;
- AWS;
- Render;
- Postgres;
- Redis.

## 9. Plugins Teach Senten

An extension is not merely a CLI proxy. It contributes knowledge to Senten's semantic model.

For example, a React adapter can teach Senten about:

- components;
- hooks;
- context;
- effects;
- event handlers;
- client/server boundaries;
- rendered interaction surfaces.

A Git integration can teach Senten about:

- repository state;
- branches;
- commits;
- semantic diffs;
- affected invariants;
- pre-commit gates.

## 10. Extension SDK

Senten provides an elegant SDK centered around `defineSentenExtension(...)`.

Conceptual example:

```ts
export default defineSentenExtension({
  name: "react",
  namespace: "react",
  commands({ command }) {
    command("component inspect")
      .argument("<name>")
      .handler(inspectComponent);
  },
  semantic({ register }) {
    register(ComponentAnalyzer);
    register(HookAnalyzer);
  }
});
```

The SDK supports:

- extension manifests;
- namespace registration;
- command registration;
- semantic analyzers;
- lifecycle hooks;
- capability declarations;
- compatibility constraints;
- MCP exposure;
- Observatory contributions;
- testing utilities;
- extension scaffolding.

## 11. Extension Security

Extensions are capability-restricted.

Potential capabilities include:

- `source.read`
- `source.write`
- `filesystem.read`
- `filesystem.write`
- `network.request`
- `secrets.read`
- `semantic.read`
- `semantic.write`
- `process.execute`
- `sandbox.create`

Extensions must declare requested capabilities before execution. Senten should inspect manifests without executing arbitrary extension code.

## 12. Automatic Extension Discovery

`senten init` and `senten adopt` should inspect project dependencies and suggest relevant adapters/integrations.

Example:

```text
Detected ecosystems
React
Next.js
Drizzle
PostgreSQL

Available Senten extensions
react
next
drizzle
postgres
```

Community-maintained adapters are encouraged. Senten Core maintains the protocol, SDK, security model, registry contract, and compatibility test suite rather than every ecosystem integration.

## 13. Sandbox Architecture

Senten treats environments as explicit architectural objects:

- local;
- sandbox;
- development;
- test;
- preview;
- staging;
- production.

Sandbox capabilities include:

- process isolation;
- runtime isolation;
- WASM component isolation;
- containers;
- microVM providers;
- remote disposable environments;
- synthetic secrets;
- restricted network egress;
- ephemeral databases;
- masked production-like data;
- branch sandboxes;
- agent sandboxes;
- resource budgets;
- snapshots;
- forks;
- deterministic reproduction.

Principle:

> **Safe by simulation. Real by promotion.**

## 14. Interaction Assurance

Senten's Interaction Engine provides:

```bash
senten crawl
senten clickthru
senten journey
```

It validates:

- links;
- buttons;
- forms;
- menus;
- tabs;
- routes;
- dialogs;
- responsive states;
- device-specific interactions;
- dead controls;
- unreachable routes;
- null transitions;
- broken journeys;
- regressions;
- visual/actionability problems.

Web adapters may use Playwright; native adapters may use Appium, Maestro, XCUITest, UIAutomator, or ecosystem-specific providers.

## 15. Observatory

Senten Observatory is an optional local visual workbench. It is not required to use Senten.

Observatory visualizes:

- StateTruss;
- semantic graph;
- interactions;
- journeys;
- policies;
- data lineage;
- environments;
- sandboxes;
- runtime traces;
- evidence;
- agents;
- changes;
- failures;
- cross-platform state.

The GUI must remain a projection of the same command/semantic core used by the CLI and machine interfaces.

## 16. Reports

All Senten analyses produce canonical structured results that may be rendered as:

- terminal output;
- JSON;
- Markdown;
- HTML;
- PDF;
- SARIF;
- JUnit-compatible output where relevant.

Examples:

```bash
senten report clickthru --format pdf
senten report security --format markdown
senten report architecture --format html
senten report full --format pdf
```

## 17. Agent-Native Development

Agents are first-class actors with explicit capability grants.

Senten supports:

- task context bundles;
- change bundles;
- scoped filesystem access;
- bounded tool access;
- sandboxed execution;
- provenance;
- impact analysis;
- agent-aware operation history;
- MCP tool generation;
- A2A interoperability.

Agents should never receive production authority by default.

## 18. LaunchProof Native Integration

LaunchProof is a natural native integration for Senten.

Senten defines architectural claims, invariants, expected behavior, policies, interactions, and evidence interfaces.

LaunchProof independently evaluates whether the implementation and collected evidence support those claims.

Relationship:

```text
Senten
Define • Build • Constrain • Explain
        ↓
Application
        ↓
LaunchProof
Inspect • Verify • Prove • Release
```

Senten may expose a native integration namespace:

```bash
senten launchproof inspect
senten launchproof verify
senten launchproof release
senten proof --provider launchproof
```

LaunchProof results can feed Senten's Evidence Engine, Observatory, reports, guarantees, and promotion gates.

Senten must not treat LaunchProof as mandatory. The integration is optional and provider-based.

## 19. Initial Release Strategy

### v0.1

- Semantic Core;
- StateTruss foundation;
- Universal Elements;
- Application IR;
- Action execution pipeline;
- Policy/invariant/effect primitives;
- initial CLI;
- element operations with dry-run/history;
- Extension Protocol v0;
- Extension SDK skeleton;
- Node/TypeScript adapter foundation;
- local sandbox provider;
- initial Next.js adapter;
- initial Git integration;
- MCP interface.

### v0.2

- semantic diff;
- impact analysis;
- undo/rollback improvements;
- Interaction Engine foundations;
- `crawl` and `clickthru`;
- Markdown/HTML/PDF reports;
- Observatory alpha;
- React adapter;
- LaunchProof integration alpha.

### v0.3

- Expo/Tauri adapters;
- native/mobile interaction providers;
- data classification;
- state sync/offline primitives;
- branch/agent sandboxes;
- extension registry protocol;
- semantic package install observation.

### v1.0

- stable Application IR;
- stable Universal Element Reference protocol;
- stable Extension Protocol/SDK;
- stable capability model;
- stable machine interface;
- production-grade sandboxing/security;
- documented community extension certification/compatibility suite.

## 20. Success Criteria

Senten succeeds when:

- developers can understand unfamiliar applications materially faster;
- agents can receive precise task context without rereading entire repositories;
- changes reveal semantic impact before merge;
- destructive changes are safer and reversible;
- framework ecosystems can extend Senten without Senten Core changes;
- a single application architecture can span web, mobile, desktop, server, and agents;
- runtime behavior can be compared with declared architecture;
- interactions can be validated automatically across surfaces/devices;
- applications can explain meaningful parts of themselves;
- evidence can be exported, visualized, and independently verified.

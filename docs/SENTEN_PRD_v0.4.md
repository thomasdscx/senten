# Senten — Product Requirements Document v0.4

**Repository:** `senten`  
**Tagline:** **Architecture for Living Software.**  
**Status:** active implementation specification

## 1. Product definition

Senten is a semantic application architecture framework for building, understanding, testing, securing, evolving, reusing, and operating software across humans, AI agents, frameworks, runtimes, and platforms.

Senten adds an explicit machine-readable architecture layer above source code. Code remains implementation; Senten maintains the application's meaning, constraints, change history, reusable architecture, evidence, and operational context.

Core thesis:

> Code should not be the only representation from which humans and machines must infer what a software system means.

## 2. North star

```text
Intent
  -> Decision
  -> Blueprint
  -> StateTruss
  -> Implementation
  -> Verification
  -> Runtime
  -> Evidence
  -> Memory
  -> Architecture
```

Senten calls this model **Living Software**: software whose architecture, invariants, decisions, evidence, history, and runtime observations remain inspectable and evolve with the implementation.

## 3. Required architectural properties

Senten must remain:

- framework-agnostic and language-neutral at the Application IR boundary;
- local-first and useful without a hosted Senten account;
- secure by construction and fail-closed around privileged behavior;
- agent-native without making agents privileged superusers;
- extensible without requiring Senten Core to maintain every ecosystem adapter;
- inspectable, explainable, and deterministic wherever deterministic evidence is available;
- lightweight at runtime, moving analysis-heavy behavior to development/CI tooling;
- reversible where possible and explicit where changes are only compensatable or irreversible.

## 4. StateTruss

StateTruss is Senten's structural application model connecting:

- resources;
- actors;
- features;
- actions and queries;
- policies and invariants;
- state and data;
- effects and capabilities;
- providers;
- UI surfaces;
- tests and journeys;
- evidence;
- architectural decisions;
- runtime observations;
- ownership and dependencies.

Every semantic element has a stable identity.

## 5. Universal Elements

Anything addressable by Senten is a Universal Element.

Canonical examples:

```text
file:src/auth/session.ts
component:CheckoutButton
route:/checkout
resource:Project
action:project.create
policy:project.delete
feature:billing
template:secure-saas
profile:team-standard
checkpoint:before-auth
```

Humans may use unqualified targets when unambiguous. Machines should prefer canonical references.

## 6. Safe operation model

Senten maintains an append-only **Operation Ledger**.

Every meaningful change records:

- actor identity;
- intent;
- targets;
- environment;
- session;
- transaction;
- branch and Git commit when available;
- reversibility class;
- rollback recipe;
- operation events;
- verification metadata.

Reversibility classes:

- reversible;
- compensatable;
- restorable from snapshot;
- irreversible.

`senten undo` must walk backward through currently-applied reversible operations. Targeted undo performs conflict analysis before reversal. Batch undo previews by default and requires explicit application.

## 7. Sessions, transactions and checkpoints

Senten groups work as:

```text
Session
  -> Transaction
      -> Operation
```

Sessions capture an actor's coherent period of work. Transactions group a logical change. Checkpoints record safe rollback boundaries.

## 8. Local State Layer

Senten defines three distinct local information classes.

### Cache

Disposable and rebuildable:

- AST parse output;
- graph indexes;
- framework discovery;
- file hashes;
- generated context bundles.

### State

Durable local truth:

- operation ledger;
- sessions and transactions;
- checkpoints;
- profiles;
- semantic identities;
- package/registry state;
- evidence and baselines.

The default durable local provider is SQLite at `.senten/senten.db`.

### Memory

Typed, scoped contextual knowledge for humans and agents:

- decisions;
- rules;
- conventions;
- instructions;
- skills;
- facts;
- preferences;
- active context.

Anything required for audit, undo, provenance, or evidence must never exist only in cache.

## 9. Memory hierarchy

Supported scopes include:

```text
global
profile
team
template
project
branch
session
agent
element
```

More-specific context can override broader context. Memory is typed, sourced, attributable, inspectable, and optionally expiring.

Senten memory is not an opaque AI-memory blob.

## 10. Profiles

Profiles capture how a developer or team works rather than what an application is.

Examples:

- preferred package manager;
- formatting and testing conventions;
- security baseline;
- default sandbox behavior;
- allowed extensions;
- agent restrictions;
- deployment preferences.

## 11. Templates and Blueprints

### Template

A reusable implementation package containing files plus semantic architecture metadata.

### Blueprint

A reusable semantic architecture package that may be implemented by different framework adapters.

Templates answer:

> Here is a proven implementation.

Blueprints answer:

> Here is the architecture that should be implemented.

Both may be extracted from an existing project or Universal Element.

## 12. Package and Registry Protocol

Senten defines one package envelope for reusable ecosystem artifacts.

Package kinds include:

- adapters;
- integrations;
- templates;
- blueprints;
- profiles;
- skills;
- capability providers;
- policy packs;
- interaction journeys.

Packages expose:

- name and version;
- publisher;
- Senten compatibility;
- dependencies;
- requested capabilities;
- file manifest;
- SHA-256 integrity metadata;
- variables;
- semantic metadata.

The registry protocol is decentralized. Registries may be local, organization-hosted, community-hosted, or future HTTP-compatible services.

## 13. Extension Protocol

Senten Core defines the protocol and SDK. Ecosystems teach Senten about themselves.

Adapters describe frameworks/runtimes. Integrations connect tools/services.

Extensions may register:

- command namespaces;
- semantic element types;
- detectors;
- hooks;
- templates and blueprints;
- generators;
- skills;
- providers;
- interaction drivers;
- capability requirements.

The community should be able to maintain React, Vue, Django, Rails, Flutter, Godot, and other adapters without Senten Core absorbing their implementation details.

## 14. Framework-native template grammar

Extension namespaces may register reusable templates:

```bash
senten init template react basic
senten init template vue dashboard
```

The canonical identity is equivalent to `template:react/basic`.

Extension-provided generators remain capability-bounded and inspectable.

## 15. Creation grammar

`create` is Senten's semantic creation verb:

```bash
senten create file notes.md
senten create dir src/features
senten create template secure-saas
senten create blueprint multitenant-saas
senten create profile team-standard
senten create checkpoint before-refactor
senten create decision database "Use PostgreSQL"
```

Extensions may register new creatable element types.

## 16. Interaction and Sandbox engines

Senten's Interaction Engine performs semantic-model-driven crawl, clickthrough and journey assurance across supported platform adapters.

The Sandbox Engine provides isolated, reproducible environments for agents, migrations, plugins, package installation, dynamic tests and simulations.

Principle:

> Safe by simulation. Real by promotion.

## 17. Agent-native development

Agents are first-class bounded actors.

Senten produces compact task context from semantic state, memory, relevant source, decisions, policies, invariants and tests. New models should be able to enter a project without rediscovering the architecture from scratch.

## 18. Native LaunchProof integration

Senten and LaunchProof have separate responsibilities:

- **Senten defines intent, architecture, constraints and structured evidence.**
- **LaunchProof independently evaluates whether implementation/runtime evidence supports release claims.**

The integration must preserve independence. Senten cannot mark its own declaration as externally verified merely because it produced it.

## 19. Core engines

Senten currently defines eleven logical engines:

1. Semantic Engine
2. Contract Engine
3. Policy Engine
4. Invariant Engine
5. Capability Runtime
6. Execution Engine
7. State Engine
8. Evidence Engine
9. Intelligence Engine
10. Interaction Engine
11. Sandbox Engine

The Local State Layer, Operation Ledger, Package/Registry system, Template/Blueprint system and Extension Protocol support these engines and are not additional engines merely to increase the count.

## 20. Current implementation milestone — v0.1.5 alpha

Implemented foundations:

- StateTruss/Application IR;
- Universal Element parsing;
- safe file operations;
- append-only SQLite operation ledger;
- repeated undo, targeted undo, redo;
- batch/date/actor/session selectors;
- sessions, transactions and checkpoints;
- local cache/state/memory separation;
- typed scoped memory;
- profiles;
- template and blueprint extraction;
- package integrity hashes;
- local registry protocol;
- extension template registration;
- Sandbox provider abstraction;
- React/Git/LaunchProof extension examples.

## 21. Next implementation milestone

Build 2 adds real TypeScript/JavaScript repository discovery and semantic compilation:

- AST ingestion;
- framework/language detection;
- file hash/content-addressed parse cache;
- StateTruss population from source;
- semantic diff;
- drift detection;
- architecture-aware impact analysis;
- project-memory/context generation from discovered semantics.

## 22. Long-term success criterion

A developer or agent should be able to enter an unfamiliar Senten project and ask:

```bash
senten inspect
senten memory project
senten why resource:Project
senten impact action:project.delete
senten proof tenant-isolation
```

and receive a concise, attributable, machine-readable explanation of what the software is, why it is built that way, what may change safely, and what evidence supports its guarantees.

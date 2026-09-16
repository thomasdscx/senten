# Senten Architecture Specification v0.3

## Architectural stance

Senten is a semantic control plane above framework-specific code. It does not replace frameworks, Git, databases, test runners or deployment systems; it gives them a common semantic model and safe operational layer.

## Core topology

```text
                           Senten Command Registry
                       / CLI / MCP / Observatory /
                                  |
          +-----------------------+-----------------------+
          |                                               |
   Universal Elements                              Extension Protocol
          |                                       / Adapters / Integrations
          v                                               |
      StateTruss <----------------------------------------+
          |
          +-- Semantic / Contract / Policy / Invariant engines
          +-- Capability / Execution / State engines
          +-- Evidence / Intelligence engines
          +-- Interaction / Sandbox engines
          |
          +-- Local State Layer
          |     +-- Cache Store
          |     +-- Durable State Store (SQLite default)
          |     +-- Scoped Memory Store
          |
          +-- Operation Ledger
          |     +-- Sessions
          |     +-- Transactions
          |     +-- Operations
          |     +-- Append-only events
          |     +-- Checkpoints
          |
          +-- Reuse Layer
                +-- Templates
                +-- Blueprints
                +-- Profiles
                +-- Senten Packages
                +-- Registries
```

## Operation Ledger

Operation records are immutable facts describing intended/applied work. Current status is derived from append-only events rather than rewriting historical records.

```text
operation.applied
operation.undone
operation.redone
```

An undo is itself historical evidence; it does not erase the original operation.

Targeted rollback checks for later operations touching the same Universal Elements. Batch rollback executes newest-first. Operations may be reversible, compensatable, snapshot-restorable or irreversible.

## Local state

Default project structure:

```text
.senten/
  senten.db
  state-truss.json
  cache/
  artifacts/
  packages/
```

`senten.db` is local durable state. `.senten/cache` may be deleted. Project source control should normally ignore `.senten/` while semantic configuration intended for collaboration lives in explicit project files and later exportable team packages.

## Memory

Memory records are typed and scoped. Every record stores actor, source, timestamps and status. Future remote/team providers implement the same store contracts while local-first behavior remains available.

Context resolution proceeds broad-to-specific:

```text
global -> profile -> team -> template -> project -> branch -> session -> agent -> element
```

## Templates vs Blueprints

Templates preserve implementation. Blueprints preserve architecture. A package may include a `senten.blueprint.json` extracted from StateTruss while deliberately excluding `.senten` runtime state, credentials, `.env` files, caches and generated build directories.

Applying a package verifies integrity first and refuses file overwrites by default.

## Senten Package

All registry-distributed artifacts share a common manifest. Build 1.5 implements local SHA-256 file/package integrity and local registries. Publisher signatures, remote registry transport, trust roots and sandboxed install scripts are later hardening layers.

## Extension boundaries

Core owns protocols, not ecosystem implementations. An adapter can register semantic types and templates; an integration can register operational commands and providers. Extension namespaces are resolved dynamically through the Command Registry.

## Security rules

1. Unknown does not equal safe.
2. Destructive operations require explicit authority.
3. Package application verifies integrity before copying.
4. Templates automatically exclude common secret material.
5. Runtime history/evidence never lives only in disposable cache.
6. Agent operations remain attributable to agent identity/session.
7. Arbitrary historical undo cannot overwrite current files silently.
8. Production authority is not inherited by sandboxes/plugins.
9. External effects may be compensatable but must never be misrepresented as erased.
10. LaunchProof verification remains independent from Senten declarations.

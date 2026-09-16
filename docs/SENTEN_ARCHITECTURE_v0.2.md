# Senten Architecture Specification v0.2

## 1. Architecture Overview

Senten is composed of a small semantic core surrounded by adapters, integrations, runtime providers, tooling interfaces, and optional visual/reporting surfaces.

```text
                         Human / Agent Intent
                                │
                                ▼
                           Senten CLI/API
                                │
                 ┌──────────────┼──────────────┐
                 ▼              ▼              ▼
              CLI/API         MCP/A2A      Observatory
                 │              │              │
                 └──────────────┼──────────────┘
                                ▼
                         Senten Command Registry
                                │
                                ▼
                           Semantic Core
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
                StateTruss             Application IR
                    │                       │
       ┌────────────┼────────────┐          │
       ▼            ▼            ▼          ▼
    Engines      Extensions    Providers   Adapters
       │
       ▼
    Runtime / Sandbox / Evidence
```

## 2. Engine Boundaries

### Semantic Engine
Owns semantic identities, nodes, relationships, graph queries, semantic discovery, and semantic diff inputs.

### Contract Engine
Owns input/output contracts, schema versions, validation, compatibility, and migration metadata.

### Policy Engine
Owns authentication requirements, authorization, tenant boundaries, purpose-aware access, agent grants, and privacy policy.

### Invariant Engine
Owns explicit guarantees, invariant evaluation, static/runtime checks, and invariant evidence links.

### Capability Runtime
Owns provider-neutral capabilities and capability dispatch.

### Execution Engine
Owns action lifecycle, effects, idempotency, transactions, retries, durable execution, events, and compensation.

### State Engine
Owns persistent/local state, sync, offline, realtime, conflict resolution, and cross-surface state contracts.

### Evidence Engine
Owns canonical evidence objects, provenance, test results, traces, observations, and external verification results.

### Intelligence Engine
Owns impact analysis, semantic compression, context bundles, recommendations, agent-facing reasoning inputs, and change bundles.

### Interaction Engine
Owns route/interaction discovery, crawl, clickthrough, journeys, device matrices, dead-end detection, actionability, and interaction regressions.

### Sandbox Engine
Owns isolated execution, environment models, ephemeral resources, synthetic secrets, network/filesystem restrictions, branch/agent sandboxes, snapshots, forks, and environment promotion checks.

## 3. StateTruss

StateTruss is the cross-engine structural graph representing the relationship among:

```text
State
Contracts
Policies
Invariants
Capabilities
Effects
Interactions
Runtime
Evidence
```

It is not a separate database product. It is an architectural model implemented through the Semantic Engine/Application IR.

## 4. Universal Element Protocol

Canonical form:

```text
<kind>:<identifier>
```

Core element kinds:

```text
file
dir
component
route
resource
action
query
policy
invariant
feature
asset
test
provider
environment
agent
extension
```

Extensions may register additional element kinds.

Resolution rules:

1. Explicit kind always wins.
2. Bare paths resolve to file/directory elements.
3. Semantic identifiers resolve through the Semantic Graph.
4. Ambiguous identifiers require disambiguation.
5. Machine interfaces should use canonical references.

## 5. Operation Model

Every mutating Senten command creates an Operation record:

```ts
interface Operation {
  id: string;
  actor: ActorRef;
  intent: string;
  targets: ElementRef[];
  environment: EnvironmentRef;
  requestedChange: unknown;
  impact?: ImpactReport;
  permissions: PermissionDecision[];
  sandbox?: SandboxRef;
  preconditions: CheckResult[];
  diff?: ChangeBundle;
  verification?: VerificationResult[];
  rollback?: RollbackPlan;
  evidence: EvidenceRef[];
  createdAt: string;
}
```

## 6. Command Registry

CLI, MCP, Observatory, and automation pipelines consume the same command registry.

Each command declares:

- canonical name;
- human aliases;
- arguments;
- selectors;
- permissions;
- accepted Universal Element kinds;
- side effects;
- machine schema;
- output schema;
- sandbox requirements;
- help/examples.

## 7. Extension Protocol

An extension manifest includes:

```ts
interface SentenExtensionManifest {
  name: string;
  namespace: string;
  version: string;
  sentenRange: string;
  type: "adapter" | "integration" | "hybrid";
  capabilities: CapabilityRequest[];
  commands?: CommandManifest[];
  semanticTypes?: SemanticTypeManifest[];
  hooks?: HookManifest[];
  machineTools?: MachineToolManifest[];
}
```

Extensions can contribute:

- command namespaces;
- Universal Element kinds;
- semantic analyzers;
- graph relationships;
- StateTruss relationships;
- Interaction Engine drivers;
- sandbox providers;
- report renderers;
- Observatory panels;
- MCP tools;
- provider implementations.

## 8. Extension Lifecycle

Initial hooks:

```text
onInit
onAdopt
onDiscover
onCompile
onSemanticGraph
onBeforeRun
onAfterRun
onBeforeCommit
onAfterCommit
onSandboxCreate
onSandboxDestroy
onProof
onReport
onDrift
onClickthru
```

Hooks run under declared capabilities.

## 9. Extension Security

Extension execution must be deny-by-default.

Extensions should be inspectable before activation. The runtime may use process, WASM, container, or stronger sandbox boundaries depending on risk and capability requests.

## 10. Sandbox Model

Isolation tiers:

```text
0 Process
1 Runtime-restricted process
2 WASM component
3 Container
4 MicroVM
5 Remote disposable environment
```

The Sandbox Engine chooses the minimum sufficient isolation level.

## 11. Environment Model

Environment is a semantic object, not just a string variable.

Each environment can define:

- runtime;
- providers;
- secrets policy;
- data policy;
- network policy;
- filesystem policy;
- destructive action policy;
- agent policy;
- retention/TTL;
- promotion requirements.

## 12. Interaction Model

Interaction nodes include:

- UI element;
- route;
- state transition;
- semantic action;
- external effect;
- completion state.

`clickthru` performs graph traversal with configurable coverage strategies and validates observed behavior against declared/learned semantics.

## 13. Report Model

Every analysis creates canonical JSON-like results first. Renderers produce human/CI formats afterward.

Supported targets:

```text
human
json
markdown
html
pdf
sarif
junit
```

## 14. LaunchProof Integration Contract

Senten exports assurance inputs to LaunchProof:

- semantic graph snapshot;
- declared invariants;
- policies;
- interaction results;
- sandbox evidence;
- build/test evidence;
- capability/effect declarations;
- environment contracts;
- provenance.

LaunchProof returns:

- verified claims;
- failed claims;
- unknown claims;
- evidence references;
- policy/release decisions;
- findings;
- confidence/evidence levels where applicable.

Senten stores returned results as external Evidence Engine objects with provenance `provider:launchproof`.

## 15. Progressive Adoption

`senten adopt` discovers existing architecture without executing untrusted code by default.

Suggested sequence:

```text
Static discovery
→ dependency/framework detection
→ semantic proposal
→ unknown-boundary reporting
→ optional sandboxed runtime discovery
→ developer acceptance
→ explicit semantic architecture
```

## 16. Lightweight Core Principle

Complex graph analysis, impact analysis, AI context generation, visualization, and reporting should remain development/CI tooling where possible. Runtime bundles should contain only capabilities required at runtime and remain tree-shakable.

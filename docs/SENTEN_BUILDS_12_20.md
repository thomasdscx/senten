# Senten Builds 12–20 — Alpha Capability Sprint

Senten 0.20.0-alpha.0 is a cumulative alpha sprint. It deepens the platform without declaring the v1 contracts stable.

## Build 12 — Release and documentation hardening

- npm/GHCR/GitHub release lanes remain separate from stable `latest` policy.
- release artifacts, SHA-256 checksums and CycloneDX SBOM remain first-class.
- npm workflow is prepared for OIDC Trusted Publishing rather than a long-lived publish token.
- public CLI/distribution documentation is updated for `senten@alpha`.

## Build 13 — Existing-application adoption

`senten adopt` can initialize an existing project, run safe static Source Intelligence, detect architecture signals, and write `.senten/artifacts/adoption-report.json`.

It detects framework/dependency, route, auth/data, environment, CI, test and risk signals without executing repository code.

## Build 14 — StateTruss semantic depth

Explicit semantic architecture can now be added from the CLI:

```bash
senten declare resource invoice
senten declare action invoice.create
senten declare policy invoice.create
senten declare invariant invoice.nonnegative
senten relate action:invoice.create writes resource:invoice
senten relate action:invoice.create requires policy:invoice.create
senten relate action:invoice.create preserves invariant:invoice.nonnegative
senten why action:invoice.create
```

Manual declarations remain distinct from discovered source nodes.

## Build 15 — Capability runtime foundation

Provider-neutral capability configuration and operational budgets are now addressable through the CLI:

```bash
senten capability register ai local-ollama --priority 100
senten capability budget ai --latency-ms 5000 --tokens 12000 --cost-usd 0.25
senten capability check ai --latency-ms 1200 --tokens 4200
```

Provider selection is fail-closed when no provider exists and exposes graceful-degradation state separately from health.

## Build 16 — Agent-native Git context

The first-party Git integration now supports persistent project-scoped identity binding without storing credentials:

```bash
senten git bind ThomasDSCX --remote origin --permission read --permission branch --permission commit
senten git context
senten git doctor
```

Task Context Bundles may include the project Git binding, while credentials remain excluded.

## Build 17 — Safe simulation plans

`senten simulate` creates declarative fault-injection plans for isolated sandbox execution. Plans cannot silently affect production.

```bash
senten simulate provider --target capability:email --value unavailable
senten simulate latency --target capability:database --value 1200ms
```

## Build 18 — Extension ecosystem

The signed package/trust/compatibility model from Build 8 remains the ecosystem foundation. Extension validation, per-command capabilities, package integrity and publisher trust remain distinct concepts and are now documented as v1 stabilization inputs.

## Build 19 — Observatory adoption intelligence

Observatory adds an Adoption view and `/api/adoption`, using the same safe static adoption model as the CLI.

## Build 20 — Stabilization surface

`senten compatibility` reports the currently supported Application IR, command-schema, extension-protocol, registry-protocol and local-state schema contracts.

The 0.20 alpha intentionally does **not** promise frozen v1 compatibility. It gives downstream integrations a machine-readable compatibility boundary while the public API is still evolving.

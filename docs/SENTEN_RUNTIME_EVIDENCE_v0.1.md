# Senten Runtime State & Evidence Intelligence v0.1

Status: implemented in `0.6.0-alpha.0`.

## Purpose

Build 6 connects Senten's declared and source-discovered architecture to observed runtime behavior without treating observation as proof by default.

The evidence ladder is explicit:

1. `declared` — architecture says a claim should be true.
2. `observed` — runtime/interaction behavior was seen.
3. `tested` — a deterministic test/check exercised the claim.
4. `verified` — a verification source independently establishes the claim.

`failed` contradicts a claim and dominates a positive guarantee result. Missing evidence is `unknown`; it is never silently interpreted as passing.

## Runtime observation model

A runtime observation records:

- semantic subject such as `action:invoice.create` or `invariant:tenant-isolation`;
- kind (`action`, `invariant`, `policy`, `effect`, `state-transition`, `error`, `custom`);
- status (`started`, `observed`, `passed`, `failed`, `denied`, `unknown`);
- environment and source;
- optional trace/parent IDs;
- timestamps and duration;
- actor/provenance metadata;
- optional input/output hashes rather than raw sensitive values.

Runtime observations are durable in `.senten/senten.db`.

## Commands

```bash
senten runtime status
senten runtime observe invariant:tenant-isolation --kind invariant --status passed
senten runtime ingest runtime.jsonl --env test
senten runtime observations
senten runtime traces
senten runtime trace trace_123
senten runtime alignment
senten runtime alignment --strict
```

`runtime ingest` accepts a JSON object, JSON array, `{ "observations": [...] }`, or JSONL.

## Evidence ledger

```bash
senten evidence list
senten evidence summary
senten evidence summary invariant:tenant-isolation
senten evidence inspect ev_123
senten evidence add invariant:tenant-isolation "integration suite passed" --status tested --source ci
senten evidence export --output evidence.json
```

Runtime and interaction systems can create evidence automatically. Evidence is also linked into StateTruss as `evidence:*` nodes with `supports` or `contradicts` relationships where the semantic subject is known.

## Guarantees and proof

```bash
senten guarantee invariant:tenant-isolation
senten proof
senten proof invariant:tenant-isolation
senten proof --strict
```

Guarantee evaluation is evidence-grounded. Runtime observation alone normally produces an `observed` result rather than `verified`. An undeclared runtime-only subject is not promoted into a guarantee merely because it emitted successful observations.

## Runtime alignment

`senten runtime alignment` compares runtime subjects against StateTruss and reports:

- declared semantic subjects;
- observed subjects;
- matched subjects;
- runtime-only subjects;
- declared but currently unobserved subjects;
- runtime failures;
- observational coverage.

Coverage is visibility, not correctness. A high coverage percentage does not independently establish security or release readiness.

## Runtime package integration

`ExecutionEngine` now supports optional runtime/evidence sinks. Action execution can emit observations for actions, policies, declared effects and invariants, while retaining normal in-process result evidence.

The sink contract is intentionally provider-neutral so applications can later send runtime records through files, sockets, OpenTelemetry adapters, remote collectors, sandboxes or other providers without coupling core application code to Senten's local SQLite store.

## LaunchProof boundary

Senten gathers and structures evidence. LaunchProof remains an independent assurance system capable of consuming claims/evidence and performing external verification. Senten does not mark a claim verified simply because Senten itself declared it.

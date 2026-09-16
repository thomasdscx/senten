# Senten Observatory & Canonical Reporting Specification v0.1

## Purpose

Build 7 introduces a shared read model for humans, CLI automation, agents, reports and the future desktop Observatory. Analysis logic remains in Senten Core and its engines; Observatory is a view over that state, not a second implementation.

## Canonical Project Snapshot

The reporting package joins:

- StateTruss/Application IR;
- operation ledger state;
- scoped memory;
- workflows;
- sandboxes;
- Interaction Assurance;
- agents and agent runs;
- runtime observations/traces;
- evidence and guarantee evaluation.

The snapshot is the source for both report renderers and Observatory APIs.

## CLI

```bash
senten report project --format html
senten report architecture --format md
senten report evidence --format json --output evidence.json
senten report list

senten observatory
senten observatory --open
senten observatory --port 0
```

Supported report kinds:

- project
- architecture
- evidence
- runtime
- interactions
- agents
- operations

Supported v0.1 report formats:

- JSON — canonical machine-readable artifact
- Markdown — portable documentation artifact
- HTML — standalone, print-friendly human report

Native PDF rendering remains a renderer extension target rather than adding a heavy browser dependency to Senten Core.

## Observatory Security

Observatory v0.1 is deliberately read-only.

Default binding:

```text
127.0.0.1:43177
```

Non-loopback exposure is rejected unless the user explicitly passes `--allow-remote`. Responses disable caching, set content-type protections, and the UI is served with a restrictive Content Security Policy.

The initial HTTP surface accepts GET only. Mutating workflows remain in the CLI/Command Registry where operation-ledger, actor and permission controls already apply.

## Views

The initial UI contains:

- Overview
- Architecture
- Evidence
- Runtime
- Interactions
- Agents
- History

Future Observatory builds can add interactive graph traversal, semantic timelines, comparison views, report composition and controlled actions through the Command Registry.

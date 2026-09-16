# Senten Interaction Assurance Specification v0.1

Status: Build 4 / `0.4.0-alpha.0`

## Purpose

Interaction Assurance validates how an application behaves from a user-facing perspective and converts those observations into Senten evidence. It complements static Source Intelligence: source discovery explains what the application appears to contain, while Interaction Assurance observes what can actually be reached and interacted with at runtime.

## Commands

```bash
senten crawl <url>
senten clickthru <url>
senten journey create <name> [base-url]
senten journey run <name>
senten journey list
senten journey inspect <name>
senten journey history
senten paths [interaction-run-id]
```

## Crawl

`senten crawl` is dependency-free and uses HTTP discovery to map same-origin pages, links, buttons, forms and inputs. It records HTTP failures and persists the resulting graph to the local state database.

The crawler does not execute application JavaScript and is appropriate for fast route/link health discovery.

## Clickthru

`senten clickthru` uses Playwright when installed. It inventories rendered interactive controls, validates visibility/enabled state and safely probes controls that are unlikely to perform destructive or external side effects.

By default Senten avoids probing submit controls and labels that indicate actions such as delete, purchase, payment, publish, deploy, save, send, refund or logout. `--include-actions` deliberately broadens that behavior and should normally be used only against a sandbox/test environment.

A safe probe compares URL, DOM-state fingerprint and dialog activity before and after the click. A click that succeeds but produces no observable change is recorded as a `null-interaction` finding.

Browser commands are optional-dependency features. Static `crawl` remains available without Playwright.

## Journeys

Journeys are deterministic user-flow definitions stored under `.senten/journeys/`.

Supported v0.1 steps:

- `goto`
- `click`
- `fill`
- `press`
- `expect-url`
- `expect-text`
- `expect-visible`

Journeys support inputs and browser selection and persist run/finding history in the local state layer.

## Evidence

Interaction runs are persisted in SQLite as:

- interaction runs
- interaction nodes
- interaction edges
- findings

Each persisted crawl or clickthru run also creates an `evidence:interaction/<run-id>` StateTruss node. When a runtime URL corresponds to an existing semantic route, the evidence node is connected to that route with an `observes` edge.

This lets later proof/reporting systems combine declared architecture, static discovery and observed behavior.

## Safety

Interaction testing can have real side effects. Senten therefore distinguishes safe discovery from deliberate action execution.

Recommended workflow for applications with mutations:

```text
Docker/local sandbox or dedicated test environment
  -> start app
  -> senten crawl
  -> senten clickthru
  -> senten journey run critical-flow
  -> inspect evidence/findings
```

The Interaction Engine must never claim that probing a live production system is side-effect-free.

## Future work

Planned later layers include:

- screenshot/video evidence
- overlay and hit-target detection
- responsive/device matrices
- authenticated state fixtures
- accessibility integration
- native mobile/desktop drivers
- interaction regression baselines
- semantic expectation matching
- visual anomaly detection
- deeper StateTruss route/state coverage

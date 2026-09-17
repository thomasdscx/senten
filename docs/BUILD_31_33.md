# Builds 31–33 — Self-model, Scenario Lab, Showcase

## Build 31 — Senten self-model

Senten now consumes `senten.architecture.json` as a declarative architecture overlay. The Senten repository uses it to declare security and assurance policies/invariants that source analysis cannot infer safely.

## Build 32 — Scenario Lab

The repository contains a controlled golden corpus spanning Next.js, missing policy, tenant-isolation regression, npm monorepo, Expo, and Tauri scenarios. `senten scenario verify-all` must pass before release.

## Build 33 — Showcase

`senten showcase build` generates static JSON artifacts from genuine Scenario Lab runs. `apps/showcase` renders those artifacts as an interactive terminal-style demo. No arbitrary visitor repository is executed by the static demo.

## Dogfood hardening finding

Self-analysis revealed that fixture sources could pollute application discovery. `.sentenignore` was added and covered by regression tests so controlled scenarios remain test inputs rather than application semantics.

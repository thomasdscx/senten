# Migration — v0.9.0-alpha.0 → v0.10.0-alpha.0

Build 10 is backward-compatible with the Build 9 local state format. Opening a project with v0.10 automatically records schema version 10 in SQLite and adds the migration ledger table.

Recommended upgrade:

```bash
npm install
npm run preflight
npm link
senten doctor
senten release check
```

No project files are rewritten by the migration. Existing operations, memory, agents, workflows, sandboxes, evidence, reports and assurance records remain in place.

`senten doctor --strict` now treats optional subsystem checks such as undiscovered source intelligence as strict failures. Use ordinary `senten doctor` for health checks and `--strict` for release gates.

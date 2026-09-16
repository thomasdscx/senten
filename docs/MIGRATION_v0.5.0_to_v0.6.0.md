# Migration: Senten 0.5.0-alpha.0 → 0.6.0-alpha.0

No destructive migration is required. Opening a project with Build 6 creates additive SQLite tables for runtime observations, runtime traces and evidence records.

Run:

```bash
npm install
npm run preflight
npm link
senten --version
senten doctor
senten runtime status
senten evidence summary
```

`ExecutionEngine.execute()` now returns both `evidence` and `observations`. Existing callers that only use `.value` or `.evidence` remain compatible.

Evidence semantics are intentionally conservative: a successful runtime observation is observational evidence, not independent verification.

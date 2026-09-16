# Senten migration — v0.10.1-alpha.0 → v0.10.2-alpha.0

No local-state schema migration is required.

This patch improves CLI experience and workflow authoring while preserving Build 10.1 project state. Existing `.senten/` databases, StateTruss IR, histories, templates, profiles, registries, agents, evidence, and workflows remain compatible.

After replacing the source tree:

```bash
npm install
npm run preflight
npm link
senten --version
```

Expected version: `0.10.2-alpha.0`.

# Migration — Senten v0.1.0-alpha.0 to v0.1.5-alpha.0

Build 1.5 is designed to upgrade an existing Build 1 project without discarding its semantic graph.

## Requirements

Node.js `>=22.5` is now required because the default local durable state provider uses Node's built-in SQLite API.

## Upgrade

Replace repository source files with Build 1.5, then run:

```bash
npm install
npm run preflight
npm link
```

Inside a project previously initialized by Build 1, run:

```bash
senten init --force
```

This recreates configuration/StateTruss bootstrap files, so do **not** run `--force` in a project whose StateTruss has already been manually populated beyond the initial application node. For an already-active initialized project, simply run any state-aware Build 1.5 command (for example `senten doctor`) after updating the codebase; `.senten/senten.db` will be created when the local state provider is opened.

Legacy `.senten/history.jsonl` migration occurs during `senten init`. The original file is retained and annotated rather than deleted.

For the Senten framework repository itself, `.senten/` remains ignored and can safely be reinitialized for CLI testing.

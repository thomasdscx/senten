# Migration: 0.1.6-alpha.0 → 0.2.0-alpha.0

No destructive state migration is required.

After replacing the repository files:

```bash
npm install
npm run preflight
npm link
senten --version
senten discover
senten baseline accept
```

Existing operation history, memory, templates, profiles, registry configuration and workflows remain compatible. Build 2 adds the `@senten/source-intelligence` workspace and rebuildable `.senten/cache/source` artifacts.

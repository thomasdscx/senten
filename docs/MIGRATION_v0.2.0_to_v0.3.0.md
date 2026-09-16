# Migration — Senten v0.2.0 to v0.3.0

No destructive migration is required. The SQLite store creates the new sandbox, sandbox-run and snapshot tables automatically on first use.

Recommended upgrade procedure:

```bash
npm install
npm run preflight
npm link
senten --version
senten doctor
senten sandbox providers
```

Existing StateTruss data, operation history, memory, templates, workflows and architecture baselines remain compatible.

The old temporary `senten sandbox create` smoke-test behavior has been replaced by persistent sandbox lifecycle commands. Sandboxes now remain available until destroyed or expired by TTL.

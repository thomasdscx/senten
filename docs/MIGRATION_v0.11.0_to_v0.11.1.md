# Migration: v0.11.0-alpha.0 → v0.11.1-alpha.0

No state database migration is required.

Changes:
- distribution allowlist test now matches the intentionally narrow npm package contents;
- no-command CLI invocation shows a concise welcome/quick-start surface;
- `senten init` prints next-step guidance;
- Node 22.5+ remains canonical; Bun is explicitly experimental;
- non-blocking Bun compatibility CI added on Linux.

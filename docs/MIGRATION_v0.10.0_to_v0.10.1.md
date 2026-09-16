# Senten migration — v0.10.0-alpha.0 → v0.10.1-alpha.0

This is a Windows acceptance hardening patch.

No Local State or StateTruss schema migration is required.

Changes:

- Source Intelligence resolves semantic module paths with `node:path.posix`, making import-edge discovery host-OS independent.
- The repository test command executes test files serially to avoid Node test-worker cancellation observed on Windows during SQLite/cryptographic test files.

Run:

```powershell
npm install
npm run preflight
npm link
```

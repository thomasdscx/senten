# Migration — Senten v0.7.0 to v0.8.0

No destructive state migration is required.

Run:

```bash
npm install
npm run preflight
npm link
senten --version
```

Expected version: `0.8.0-alpha.0`.

New commands:

```bash
senten registry add <name> <path-or-url>
senten registry search <query>
senten registry fetch <registry/name>
senten package sign <path> --key <private.pem>
senten package install <registry/name>
senten trust keygen --publisher <name>
senten trust add <public.pem> --publisher <name>
senten trust list
senten extensions inspect <namespace>
senten extensions validate <namespace>
```

Existing local registries continue to work unchanged.

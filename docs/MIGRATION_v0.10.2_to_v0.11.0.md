# Senten migration — v0.10.2-alpha.0 → v0.11.0-alpha.0

No Local State database migration is required.

Build 11 is a distribution/release-engineering build. It adds cross-platform CI, public npm package metadata, Docker packaging, GitHub release artifacts, checksums/SBOM generation, container signing configuration and release channels.

A friendly alias is also added:

```bash
senten create sandbox
```

The canonical domain-first command remains:

```bash
senten sandbox create
```

After upgrading:

```bash
npm install
npm run preflight
npm link
senten --version
```

Expected version: `0.11.0-alpha.0`.

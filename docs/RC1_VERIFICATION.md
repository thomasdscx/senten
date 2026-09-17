# Senten 1.0.0-rc.1 verification

RC1 is a release candidate, not a stable-production guarantee.

## Implemented hardening in Builds 26–30

- Next.js App Router route-handler semantics and HTTP action nodes.
- Supabase adapter for provider, table/resource, auth and storage semantics.
- Explainable bounded blast-radius analysis through `senten impact`.
- MCP traversal and authority-escalation denial.
- pnpm workspace adoption coverage.
- CLI/source distribution-alignment diagnostics.
- RC compatibility markers and `senten release check --rc`.
- npm/GHCR `rc` release channels.

## Release gates

Before publishing RC1:

1. `npm run preflight` passes locally.
2. Windows, macOS and Linux GitHub CI pass on the exact commit.
3. Docker build and smoke tests pass on the exact commit.
4. `npm pack --dry-run` contains only intended runtime artifacts.
5. A clean machine/project can install `senten@rc`, initialize, discover, adopt, inspect compatibility and run doctor.
6. MCP remains read-only by default and adversarial scope tests pass.
7. Docker mutation boundary is validated on a real Docker engine.
8. GitHub Release artifacts include checksums and SBOM.

Stable `1.0.0` requires evidence from RC dogfooding rather than only unit-test success.

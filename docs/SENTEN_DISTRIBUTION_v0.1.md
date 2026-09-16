# Senten Distribution Specification v0.1

Senten is local-first and cross-platform. Distribution is separated from runtime deployment.

## Official alpha channels

1. **npm / project-local** — preferred for deterministic team and CI use.
   - `npm install -D senten@alpha`
   - `npx senten ...`
2. **npm / global** — convenient developer workstation install.
   - `npm install -g senten@alpha`
3. **Docker / GHCR** — reproducible CI, remote worker and self-hosted execution.
   - `ghcr.io/thomasdscx/senten:alpha`
4. **GitHub Releases** — npm tarball, SHA-256 checksums, release manifest and SBOM.

Standalone signed Windows/macOS/Linux executables and OS package-manager channels are planned after the alpha package surface stabilizes.

## Supported hosts

The CLI semantic model is host-neutral and targets:

- Windows x64
- macOS arm64/x64
- Linux x64/arm64

CI verifies Windows, macOS and Linux on Node 22. Semantic paths use `/` regardless of host OS. Host-specific translation belongs at filesystem/process-provider boundaries.

## Docker

The official image uses Node 22 Debian slim, runs as an unprivileged `node` user, and includes only built Senten runtime files plus production dependencies.

### PowerShell

```powershell
docker run --rm -v "${PWD}:/workspace" ghcr.io/thomasdscx/senten:alpha discover
```

### Windows Command Prompt

```cmd
docker run --rm -v "%cd%:/workspace" ghcr.io/thomasdscx/senten:alpha discover
```

### macOS/Linux

```bash
docker run --rm -v "$PWD:/workspace" ghcr.io/thomasdscx/senten:alpha discover
```

## Release channels

- `alpha` — active architecture/API development.
- `beta` — feature-complete candidates with compatibility focus.
- `latest` — stable releases only.

CI and production workflows should pin exact versions rather than floating tags.

## Supply-chain controls

Tagged releases produce:

- npm package tarball;
- `SHA256SUMS`;
- canonical `release-manifest.json`;
- CycloneDX npm SBOM;
- multi-architecture Docker image (`linux/amd64`, `linux/arm64`);
- keyless Sigstore/Cosign signature for published container images;
- npm provenance when publishing through the release workflow.

## Registry vs npm

npm distributes the Senten implementation/CLI. The Senten Registry Protocol distributes Senten ecosystem artifacts such as adapters, integrations, templates, blueprints, workflows, profiles and skills. They are deliberately separate systems.

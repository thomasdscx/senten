# Senten Runtime Support

## Canonical runtime

Senten's official alpha runtime is **Node.js 22.5 or newer**. Release CI validates Node 22 on Windows, macOS and Linux.

The official container image uses `node:22-bookworm-slim`: Node 22 on Debian 12 Bookworm Slim.

## Package managers

npm is the release-reference package manager for the alpha. The published package is intended to remain usable from npm-compatible package managers including pnpm and Yarn. Bun package-manager/runtime compatibility is being validated progressively.

## Bun

Bun is an **experimental runtime compatibility target**, not the canonical runtime. A non-blocking Linux CI job checks installation, typechecking, build and CLI launch under Bun. Senten will not claim full Bun runtime support until the complete acceptance matrix passes consistently.

## Standalone binaries

Future Windows, macOS and Linux binaries should bundle the runtime they need so end users do not need Node or Bun installed. Node SEA and Bun standalone compilation are candidates and will be compared using compatibility, startup performance, binary size, reproducibility, signing and cross-platform behavior.

## Docker

Docker users do not need Node installed on the host. The official image contains its own Node runtime.

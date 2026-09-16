# Senten Extension Ecosystem & Registry Trust v0.1

Build 8 formalizes Senten's decentralized extension ecosystem.

## Goals

Senten Core defines protocols. Framework and tool communities can maintain adapters, integrations, templates, blueprints, workflows, providers, skills, journeys and policy packs without requiring changes to Senten Core.

## Registry types

### Local registry
A filesystem-backed registry used for local, team-share, offline and organization workflows.

### HTTP registry
A read-only static registry that exposes `index.json` plus package files. Senten does not require a central cloud registry.

Registry index shape:

```json
{
  "sentenRegistry": 1,
  "packages": [
    {
      "manifest": { "senten": 1, "kind": "template", "name": "demo", "version": "1.0.0" },
      "baseUrl": "https://example.test/packages/template-demo-1.0.0"
    }
  ]
}
```

## Package trust

Package integrity and publisher trust are separate.

1. SHA-256 integrity proves downloaded payload bytes match the manifest.
2. Ed25519 signatures prove a manifest was signed by a particular key.
3. The local trust store decides whether that key/publisher is trusted by the current developer/team.
4. Compatibility contracts decide whether the package is suitable for the current Senten/Node versions.

Unsigned or untrusted remote packages are not installed by default.

## Signing

```bash
senten trust keygen --publisher acme
senten package sign .senten/packages/template-demo --key .senten/keys/acme-xxxx.private.pem --publisher acme
senten trust add acme.public.pem --publisher acme
senten package verify .senten/packages/template-demo
```

Private keys are never placed in package manifests and must remain secret.

## Compatibility

Packages may declare:

```json
{
  "compatibility": {
    "senten": ">=0.8.0 <1.0.0",
    "node": ">=22.5.0"
  }
}
```

Incompatible packages are rejected before installation.

## Extension validation

The Extension SDK now validates namespaces, versions, duplicate command paths and duplicate element registrations. Extension commands may declare their own capabilities so CLI/MCP command discovery does not have to guess authority from the extension as a whole.

## Security principles

- Registry metadata is untrusted input.
- Downloading a package does not execute it.
- Package lifecycle scripts are never implicitly executed by registry fetch/install.
- Integrity does not imply trust.
- Trust does not bypass compatibility checks.
- HTTP registries remain read-only in Build 8; publishing is host/operator controlled.
- Explicit `--allow-untrusted` exists as a deliberate user override, not a default.

# Senten Package & Registry Protocol v0.1

Senten registries distribute self-describing packages without requiring one centralized Senten service.

## Package kinds

`adapter`, `integration`, `template`, `blueprint`, `profile`, `skill`, `provider`, `policy-pack`, `journey`.

## Required manifest fields

```json
{
  "senten": 1,
  "kind": "template",
  "name": "secure-saas",
  "version": "0.1.0"
}
```

Packages may also declare publisher, compatibility, requested capabilities, dependencies, variables, files and semantic metadata.

Build 1.5 includes SHA-256 integrity metadata for extracted packages. Registry transport currently implements local/filesystem registries. HTTP transport, signatures, publisher trust and revocation are deliberately future protocol layers rather than insecure placeholders.

## Registry principles

- decentralized;
- namespace-capable;
- content-verifiable;
- capability-aware;
- inspectable before execution;
- usable by humans and agents;
- no mandatory hosted Senten account.

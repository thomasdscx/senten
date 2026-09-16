# Senten release channels

Senten follows explicit distribution channels during pre-1.0 development.

| Channel | npm dist-tag | Docker tag | Intended use |
| --- | --- | --- | --- |
| Alpha | `alpha` | `alpha` | active development and early adopters |
| Beta | `beta` | `beta` | compatibility/stability testing |
| Stable | `latest` | `latest` | production-ready releases |

Always prefer exact versions in CI and security-sensitive environments.

Publishing is deliberately gated. GitHub release artifacts and Docker images are generated from tagged releases; npm publishing uses a manually approved `npm-release` GitHub environment.

# Senten release channels

Senten uses explicit distribution channels.

| Channel | npm dist-tag | Docker tag | Intended use |
| --- | --- | --- | --- |
| Alpha | `alpha` | `alpha` | active architecture development |
| Beta | `beta` | `beta` | compatibility/stability testing |
| Release Candidate | `rc` | `rc` | candidate public release and final hardening |
| Stable | `latest` | `latest` | stable releases |

Always prefer exact versions in CI and security-sensitive environments.

`1.0.0-rc.1` is the first RC line. GitHub release artifacts and Docker images are generated from tagged releases; npm publishing uses the protected `npm-release` GitHub environment with Trusted Publishing/OIDC when configured.

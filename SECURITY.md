# Security Policy

Senten treats repositories, extensions, registry metadata, downloaded packages, runtime evidence and agent input as untrusted by default.

## Reporting vulnerabilities

While the repository is private, report security issues directly to the maintainers. Before the repository is made public, configure a private GitHub Security Advisory channel and update this file with the preferred contact path. Do not open public issues for suspected vulnerabilities.

## Security principles

- Fail closed when authority or evidence is unknown.
- Static analysis must not execute repository code.
- Remote packages are not trusted solely because integrity hashes match.
- Secrets are excluded from reusable templates and assurance exports by default.
- Agents require explicit capabilities.
- Production authority is never implied by access to a sandbox or local workspace.
- Strength-4 verification must come from a trusted independent verifier.

## Supported versions

Pre-1.0 builds are development releases. Security fixes target the latest development version unless a release note states otherwise.

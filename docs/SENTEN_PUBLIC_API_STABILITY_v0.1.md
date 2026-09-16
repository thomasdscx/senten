# Senten Public API & Stability Policy v0.1

Senten is pre-1.0. APIs are classified as:

- **Core protocol:** Application IR, Universal Element references, Extension Protocol, package manifest and capability vocabulary. Changes require migration notes.
- **Alpha public API:** exported TypeScript APIs and CLI commands intended for external use. Breaking changes are allowed before 1.0 but must be documented.
- **Experimental:** commands and schemas explicitly labeled experimental, including initial release-readiness and benchmark surfaces.
- **Internal:** implementation details not documented as public API.

The v1 goal is to stabilize protocol shapes before promising long-term package-level semver guarantees.

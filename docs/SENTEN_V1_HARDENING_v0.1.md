# Senten v1 Hardening v0.1

Build 10 concentrates on stabilization rather than feature expansion.

## Added

- explicit SQLite schema versioning and migration ledger;
- SQLite integrity checks in `senten doctor`;
- `senten doctor --json` and `--strict`;
- `senten release check` with fail-closed readiness checks;
- common secret-file/publication checks;
- `senten benchmark` for repeatable local read-path measurements;
- `senten schema command <name>` for machine-readable command discovery;
- typo suggestions for unknown top-level commands;
- security, contribution, governance and API stability documentation;
- hardened CI defaults and release-readiness tests.

## Non-claims

Build 10 is a public-release readiness milestone, not a claim that Senten has reached a final stable v1.0 API. The framework remains alpha until the maintainers complete real-world dogfooding, threat review, extension compatibility testing and public API stabilization.

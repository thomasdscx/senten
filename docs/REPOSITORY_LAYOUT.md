# Repository Layout

The Senten GitHub repository contains the framework source, tests, documentation, adapters, integrations, and release automation.

```text
senten/
├── .github/          GitHub CI/release workflows
├── adapters/         Framework/platform adapters
├── apps/             Internal showcase/observatory applications
├── bin/              CLI entry point
├── docs/             Architecture, specifications, migration and project docs
├── examples/         Example projects/usages
├── integrations/     External integrations such as Git and LaunchProof
├── packages/         Senten core packages
├── scripts/          Build, verification and release scripts
├── tests/            Deterministic test suite
├── README.md         Project overview and quick start
├── CHANGELOG.md      Release history
├── SECURITY.md       Security policy
├── CONTRIBUTING.md   Contribution guide
├── CODE_OF_CONDUCT.md
├── LICENSE
├── package.json
└── package-lock.json
```

Generated/local directories such as `dist/`, `node_modules/`, `.senten/`, `release/`, and the separate Senten website are intentionally excluded from source control.

# Contributing to Senten

Senten is being designed as an extensible semantic application architecture framework. Contributions should preserve framework neutrality, explicit security boundaries and machine-readable behavior.

## Development

```bash
npm install
npm run preflight
npm link
```

Before submitting a change, run `npm run preflight` and, where relevant, `senten release check` against a test project.

## Design rules

1. Prefer extensible protocols over hard-coding vendor/framework behavior into Core.
2. Unknown must not be treated as safe or passed.
3. Do not execute untrusted project code during static discovery.
4. Commands that mutate state must integrate with the Operation Ledger where applicable.
5. New extension functionality must declare capabilities.
6. Keep CLI and machine-facing schemas aligned.
7. Add tests for security boundaries and failure modes, not only happy paths.

## API stability

Senten remains pre-1.0. Public package APIs may change, but breaking changes must be documented in migration notes.

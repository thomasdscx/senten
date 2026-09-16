# Migration — Senten 0.8.0 → 0.9.0

No destructive migration is required.

On first use, `.senten/senten.db` adds:

- `assurance_exchanges`
- `launchproof_results`
- `assurance_cases`

New commands:

```bash
senten assurance claims
senten assurance case create <name>
senten assurance case list
senten assurance case inspect <id|name>
senten assurance case evaluate <id|name>

senten launchproof export
senten launchproof import <result.json>
senten launchproof status

senten report assurance
```

### Behavior change

Manual evidence may no longer be created with `--status verified`. Independent verification must enter through a verifier integration such as LaunchProof. This prevents local declarations from being mislabeled as independent proof.

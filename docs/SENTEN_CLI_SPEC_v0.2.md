# Senten CLI Specification v0.2

Canonical grammar:

```text
senten <domain> <action?> <target?> [selectors] [flags]
```

Core verbs intentionally read like human actions while resolving to deterministic command schemas.

## Universal creation

```bash
senten create file README.md
senten create dir src/features
senten create template secure-saas
senten create blueprint multi-tenant-saas
senten create profile team-standard
senten create checkpoint before-auth
```

## Safe file/element manipulation

```bash
senten element page.html copy backup/
senten element logo.png move assets/branding
senten element src/auth.ts delete --dry-run
```

## Operation ledger

```bash
senten history
senten history --today
senten history --actor agent:codex
senten history --session ses_123

senten undo
senten undo op_123
senten undo op_123 --cascade
senten undo all --today
senten undo all --today --apply
senten redo
senten redo all
senten redo all --apply
```

`undo all` and `redo all` are preview-only unless `--apply` is supplied. Batch redo replays the most recent undo batch in forward dependency order when no explicit selector is supplied.

## Workflows

```bash
senten create workflow pre-release
senten workflow list
senten workflow inspect pre-release
senten workflow run pre-release --dry-run
senten workflow run pre-release --input environment=staging
senten use workflow pre-release
senten workflow history
senten workflow package pre-release
senten workflow install team/pre-release
```

Workflows execute registered Senten commands, not arbitrary shell strings. They support typed inputs, interpolation, basic deterministic conditions, nested workflows, explicit failure policies, dry-run planning, durable run history, registry packaging, and Operation Ledger attribution.

## Work grouping

```bash
senten session start "billing refactor"
senten transaction start "move billing domain"
...
senten transaction end
senten session end

senten checkpoint create before-auth
senten rollback checkpoint:cp_123
senten rollback checkpoint:cp_123 --apply
```

## Memory

```bash
senten memory add decision database "Use PostgreSQL"
senten memory add rule validation "Validate all external input" --scope project
senten memory list
senten recall database
```

## Profiles

```bash
senten profile create team-standard --package-manager pnpm
senten profile use team-standard
senten profile list
```

## Templates and blueprints

```bash
senten create template my-saas
senten template list
senten template inspect my-saas
senten use template my-saas
senten init template my-saas

senten init template react basic
```

Framework-native template names are supplied by adapters through the Extension Protocol.

## Registry/package

```bash
senten registry list
senten registry add team ../team-registry
senten registry search dashboard
senten registry publish .senten/packages/template-my-saas --to team

senten package inspect ./package-dir
senten package verify ./package-dir
```

## Shared selectors

Selectors should converge across commands:

```text
--actor
--session
--transaction
--today
--since
--env
--feature
--element
--format
--json
--dry-run
--apply
```

# Senten 1.0.0-rc.9 verification

RC9 is a hardening candidate built from the RC8 package checkpoint.

## Implemented

- Framework-signal corroboration to reduce false-positive framework detection.
- Repository-wide source inventory and modeled/unsupported coverage.
- Rails/Ruby detection-level intelligence for mixed-language repositories.
- Dependency-backed security ecosystem detection for Devise, Devise Token Auth, Pundit, and JWT.
- `senten capabilities`.
- `senten status`.
- `senten report session start|stop|status|list|export` aliases over the dogfood recorder.
- `senten purge [--dry-run]`.
- `senten reset [--dry-run]`.
- `senten remove [--dry-run]`.
- Version advanced to 1.0.0-rc.9.

## Verification performed

### Chatwoot-style mixed-language fixture

Expected and observed:

- Vue detected.
- Rails detected as detection-only.
- Ruby detected as detection-only.
- A single stray `next` import does not classify the repository as Next.js.
- Devise / Devise Token Auth / Pundit / JWT are detected from the Gemfile.
- Unsupported Ruby/Vue source lowers repository coverage instead of producing a false PASS.
- Rails routes and ActiveRecord model files are surfaced as detected-but-unmodeled gaps.

### Cal.com-style Next.js fixture

Expected and observed:

- Next.js and React remain modeled.
- Repository source coverage reports 100% for the TypeScript-only fixture.
- Existing route/component/action extraction remains operational.

### Lifecycle fixture

Expected and observed:

- `purge --dry-run` previews only generated state.
- `purge` removes `.senten/` while preserving `senten.config.json`.
- `reset` rebuilds local state from the preserved configuration.
- `remove --dry-run` previews `.senten/` + `senten.config.json` while preserving project source and `senten.architecture.json`.

### Report session

Expected and observed:

- session start records Senten commands.
- session stop closes the record and exports a Markdown report automatically.

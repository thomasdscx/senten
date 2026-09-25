# Remote Repositories and Secure Learning

Senten can inspect and learn from GitHub repositories without cloning them into the project.

## Authentication

Preferred local authentication is the GitHub CLI credential store:

```bash
senten auth github login
senten auth github status
```

For CI or advanced use, `SENTEN_GITHUB_TOKEN`, `GITHUB_TOKEN`, or `GH_TOKEN` may be supplied by the process environment. Senten does not write these tokens to `senten.config.json`, `.senten`, SQLite state, logs, or knowledge packs. Tokens should have the minimum read-only repository permissions needed.

## Remote inspection

```bash
senten repo inspect owner/repository
senten repo tree owner/repository --limit 100
senten repo permissions owner/repository
```

The GitHub provider reads repository metadata, the Git tree, and selected blobs through GitHub APIs. It does not require a checkout.

## External learning

```bash
senten learn source owner/repository
senten learn source owner/repository --ref main --max-mb 2
```

Default policy:

- static-only analysis
- no clone or working tree
- no dependency installation
- no lifecycle/build scripts
- no execution of repository code
- sensitive credential paths excluded
- binary/archive/database artifacts excluded
- bounded selected-file reads
- commit/tree provenance recorded
- raw source not retained

The persistent artifact contains language/manifest inventory, hashes, selected-file metadata, framework/package/dependency facts, limits, and provenance.

Use `senten learn storage` to inspect retained knowledge size and `senten learn prune [source]` to remove it.

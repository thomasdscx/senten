# Senten Sandbox Specification v0.1

## Purpose

The Sandbox Engine provides disposable, reproducible execution environments for code, tests, package installation, agents and future interaction assurance. Repositories are treated as untrusted input. Static source discovery never implicitly executes repository code.

## Isolation tiers

### Local workspace provider

The local provider creates a sanitized project copy under `.senten/sandboxes/`. It excludes `.git`, `.senten`, dependency/build output, environment files, credentials, private keys and common secret-bearing files. It sanitizes inherited process environment and supports synthetic secrets, execution timeouts, output limits, snapshots and replay.

**It is not an OS security boundary.** It cannot truthfully enforce network denial or prevent a malicious process from escaping through operating-system facilities. Senten rejects `network=deny` for this provider rather than representing a false guarantee.

### Docker provider

The Docker provider uses an isolated container and can enforce `--network none`, memory limits, CPU limits and PID limits. It is the preferred Build 3 provider for untrusted or side-effectful execution when Docker is available.

## Core CLI

```text
senten sandbox providers
senten sandbox create [--provider local|docker] [--network inherit|deny]
senten sandbox list
senten sandbox inspect <id>
senten sandbox run <id> [--cwd path] [--timeout 30s] -- <command> [args...]
senten sandbox snapshot <id> [name]
senten sandbox restore <id> <snapshot-id>
senten sandbox runs [id]
senten sandbox snapshots [id]
senten sandbox reproduce <run-id>
senten sandbox simulate-install <package> [--provider docker] [--allow-scripts]
senten sandbox destroy <id>
```

## Secret model

Production secrets are never copied from `.env*` files. Synthetic secrets can be provisioned explicitly:

```text
senten sandbox create --synthetic-secret STRIPE_SECRET_KEY
```

Only synthetic secret names are persisted in sandbox metadata. Generated values exist only inside the disposable workspace/container context.

## Reproducibility

Before every `sandbox run`, Senten creates a pre-run snapshot and records:

- command and arguments;
- provider;
- execution timing and exit status;
- stdout/stderr hashes;
- workspace digest before and after execution;
- snapshot identity;
- environment key names, never their values.

`senten sandbox reproduce <run-id>` materializes the original pre-run snapshot into a new sandbox and replays the command.

## Package installation simulation

`senten sandbox simulate-install` installs into a disposable project copy. Lifecycle scripts are blocked by default with `--ignore-scripts`. Developers must explicitly opt into scripts with `--allow-scripts`.

## Future providers

The provider boundary is designed for Podman, WASM/WASI, microVM and remote disposable environments without changing the semantic sandbox model.

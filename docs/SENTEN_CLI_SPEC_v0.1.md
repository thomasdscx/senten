# Senten CLI Specification v0.1

## 1. Grammar

```bash
senten <domain> [action] [target] [selectors] [flags]
```

Examples:

```bash
senten proof
senten proof tenant-isolation
senten policy explain project.delete
senten graph billing --depth 3
senten clickthru checkout --device iphone-16 --env sandbox
senten element logo.png move ./assets/branding/
```

## 2. Core Domains

```text
init
adopt
dev
run
state
policy
check
proof
inspect
explain
why
graph
impact
drift
crawl
clickthru
journey
sandbox
simulate
replay
report
context
agent
observatory
element
history
undo
extension
commands
schema
```

## 3. Friendly vs Canonical Forms

Human-friendly:

```bash
senten why project.delete
```

Canonical:

```bash
senten policy explain action:project.delete --format json
```

Both route to the same internal command.

## 4. Universal Selectors

```text
--env
--surface
--actor
--resource
--feature
--since
--until
--severity
--format
--output
--compare
--include
--exclude
--where
--json
--quiet
--verbose
--dry-run
```

## 5. Element Examples

```bash
senten element page.html inspect
senten element page.html copy ./backup/
senten element logo.png move ./assets/branding/
senten element Hero.tsx rename HeroSection.tsx
senten element src/auth/session.ts delete --dry-run
senten element action:invoice.create inspect
senten element component:CheckoutButton trace
```

## 6. Extension Namespaces

Extensions may register namespaces:

```bash
senten react inspect
senten vue inspect
senten git status
senten git diff --semantic
senten expo clickthru
senten supabase inspect
```

## 7. Machine Discovery

```bash
senten commands --format json
senten commands react --format json
senten schema command proof
```

These provide authoritative schemas for agents/tooling.

## 8. Pipelines

Conceptual reusable workflow:

```yaml
pipeline:
  - sandbox:create
  - migrate:simulate
  - test
  - clickthru:critical
  - proof:release
  - report:pdf
```

CLI:

```bash
senten run pipeline release-check
```

## 9. Output Rules

All commands should support canonical structured output where practical.

Human output is presentation only; machine output is schema-versioned.

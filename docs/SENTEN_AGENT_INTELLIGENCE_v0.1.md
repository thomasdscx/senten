# Senten Agent Intelligence v0.1

Build 5 makes agents first-class, bounded Senten actors.

## Principles

- Agents fail closed: no command capability is granted implicitly.
- Agent identity and grants are durable project state.
- Task Context Bundles are compact, deterministic, inspectable project context.
- Every bounded run records actor, context bundle, command, operations, status and timestamps.
- Change Bundles make agent modifications reviewable as a logical unit.
- CLI and MCP-facing schemas derive from the same command/capability model.

## Core commands

```bash
senten agent create codex --provider openai --model codex
senten agent grant codex project.read
senten agent grant codex semantic.write
senten agent inspect codex
senten context --task "inspect billing" --agent codex --json
senten agent run codex --task "discover architecture" -- discover
senten agent history codex
senten agent change-bundle <run-id>
senten commands --format json
senten mcp schema
```

## Capability model

Core command families map to explicit capabilities such as `project.read`, `project.write`, `semantic.write`, `sandbox.execute`, `interaction.execute`, and `workflow.execute`. Deny grants override allow grants. Missing grants deny execution.

## Context Bundles

A context bundle includes only task-relevant StateTruss nodes/edges, scoped memory, recent operations, constraints, and the agent's allow/deny grants. Bundles are content-addressed and written to `.senten/artifacts/contexts/` for provenance and reproducibility.

## MCP foundation

`senten mcp schema` emits a machine-readable, stdio-ready tool schema foundation. A later build can expose the same registry through a live MCP transport without changing the command semantics.

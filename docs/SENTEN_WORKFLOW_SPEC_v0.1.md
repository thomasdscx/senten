# Senten Workflow Specification v0.1

Senten workflows are deterministic, reusable command automations executed through Senten's command surface rather than arbitrary shell scripts.

## Principles

- Registered Senten commands are the execution primitive.
- Workflows are inspectable before execution.
- `--dry-run` produces a plan and performs no steps.
- Workflow runs have stable IDs and durable local history.
- Operations created by a workflow remain attributable through the Operation Ledger.
- Failure behavior is explicit: `stop`, `continue`, or `rollback`.
- Rollback only reverses operations that Senten can safely reverse; irreversible effects are never represented as reversible.
- Extensions automatically become workflow-capable through their registered CLI namespaces.
- Workflows may be packaged and distributed through Senten registries.

## CLI

```text
senten create workflow <name>
senten workflow list
senten workflow inspect <name|run-id>
senten workflow run <name> [--input key=value] [--dry-run]
senten use workflow <name>
senten workflow history [name]
senten workflow package <name>
senten workflow install <registry/name>
```

## Definition

Workflows are JSON in v0.1 to keep the core dependency-free and deterministic.

```json
{
  "senten": 1,
  "kind": "workflow",
  "name": "pre-release",
  "version": "0.1.0",
  "onFailure": "stop",
  "inputs": {
    "environment": { "default": "staging" }
  },
  "steps": [
    { "id": "doctor", "command": "doctor" },
    { "id": "proof", "command": "proof", "args": ["--env", "${environment}"] }
  ]
}
```

## Conditions

v0.1 supports `always`, `previous.success`, `previous.failed`, and simple input equality/inequality expressions such as `input.environment == staging`.

## Deliberately deferred

Parallel DAG execution, cron/webhook triggers, distributed workers, arbitrary shell execution, durable long-running orchestration, and a general-purpose expression language remain outside this patch. The schema is designed so these can be added without changing the basic workflow identity model.

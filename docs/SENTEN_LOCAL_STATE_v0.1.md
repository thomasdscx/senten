# Senten Local State & Memory v0.1

Senten separates **cache**, **state**, and **memory**.

- Cache is disposable and rebuildable.
- State is durable operational truth.
- Memory is scoped contextual knowledge.

The default durable provider uses SQLite (`.senten/senten.db`) and WAL journaling. Build 1.5 stores operations, append-only operation events, sessions, transactions, checkpoints, memory, profiles and key/value runtime pointers.

Memory types currently include decisions, rules, conventions, instructions, skills, facts, preferences and context.

Memory scopes include global, profile, team, template, project, branch, session, agent and element.

# Migration: Senten 0.4.0-alpha.0 → 0.5.0-alpha.0

Build 5 is additive. Existing projects can replace the repository tree, run `npm install`, `npm run preflight`, and `npm link`.

The SQLite state store migrates in place by creating `agents`, `agent_runs`, and `change_bundles` tables. Existing operation, memory, workflow, sandbox, source-intelligence, and interaction data remain intact.

No agent receives permissions automatically. Create an agent and grant only the capabilities it needs.

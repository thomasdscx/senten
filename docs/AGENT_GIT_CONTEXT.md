# Agent and Git context

Senten treats repository identity as project context rather than a machine-global assumption.

The first-party Git integration can persist a project binding containing account label, repository/remote, commit identity and allowed Git operations. It deliberately does **not** persist provider tokens, SSH private keys or other credentials.

```text
senten git bind thomasdscx --remote origin --repository thomasdscx/senten
senten git context
senten git doctor
```

Task Context Bundles include the safe project Git binding when one exists. Agents remain deny-by-default and operate only with explicit grants.

Multi-agent handoffs create a new context bundle using the **target agent's** permissions:

```text
senten agent handoff planner implementer --task "implement billing invariant"
```

Handoff artifacts are project-scoped, contain provenance and permission metadata, and exclude credentials.

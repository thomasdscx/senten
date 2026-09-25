# Senten Learning, Adapters, and Knowledge Packs

Senten separates four concerns so the core can remain language-neutral:

1. **Source analyzers** parse syntax and structural facts for languages and file formats.
2. **Adapters** map framework, runtime, database, provider, or platform semantics into Application IR.
3. **Knowledge packs** carry versioned, provenance-aware semantic knowledge without executable parser logic.
4. **Project learning** observes recurring local conventions and proposes candidates for human approval.

## Trust model

Learning follows the same evidence rules as the rest of Senten:

- observed patterns are candidates, not truth;
- confidence is not evidence;
- promotion is explicit through `senten learn approve`;
- approved knowledge is scoped and reversible through project memory;
- external source ingestion is static-only by default;
- fetched source is never installed or executed by `senten learn source`.

## CLI

```text
senten learn
senten learn project
senten learn candidates [--json]
senten learn approve <id|all>
senten learn reject <id|all>
senten learn package --name <name> [--version <semver>]
senten learn install <knowledge-pack-path>
senten learn source <public-github-url> [--ref <branch-or-tag>]
senten learn <public-github-url> [--ref <branch-or-tag>]
```

## Adapter ecosystem

Adapters are public extensions that emit Senten Application IR fragments. They can be maintained by the Senten project, framework/library vendors, companies, or the community. Publisher identity and signature verification describe trust provenance; they do not make adapter output infallible.

Recommended package roles:

```text
@senten/analyzer-typescript     syntax/structure
@senten/adapter-react           framework semantics
@senten/adapter-drizzle         ORM semantics
@company/knowledge-platform     team/domain knowledge
```

A vendor-maintained adapter can provide stronger provenance, while knowledge packs can update independently of Senten Core.

# Senten Source Intelligence Specification v0.1

Status: implemented in Senten `0.2.0-alpha.0`.

## Purpose

Source Intelligence lets Senten learn application structure directly from source code without making source code the only representation of system meaning. It produces discovered semantic facts that are merged into StateTruss while preserving manually declared architecture.

## Initial language support

Deep initial parsing targets TypeScript and JavaScript, including TSX/JSX and Node ESM/CJS variants. Parsing uses the TypeScript Compiler API and never executes project code.

## Discovery pipeline

`senten discover` performs:

1. source-file discovery;
2. SHA-256 content addressing;
3. incremental parse-cache lookup;
4. AST extraction;
5. extension-provided source analysis;
6. semantic-node and relationship generation;
7. merge with manually declared StateTruss nodes;
8. StateTruss persistence.

The initial extractor recognizes files/modules, imports, external package providers, exported symbols, React-style components, action-like functions, resources, tests, Next-style page/API routes and route methods.

## Cache

`.senten/cache/source/objects/<hash>.json` contains rebuildable parse artifacts. Identical source content can be reused across scans. The cache is disposable and never contains the only copy of durable Senten state.

## Adapter teaching protocol

Adapters can contribute `sourceAnalyzers`. A source analyzer receives the current file, imports and exports and may return semantic nodes, semantic edges and framework hints. The React adapter in this build demonstrates the protocol by identifying React hook state and client-oriented source context.

Senten Core therefore does not need to permanently own ecosystem-specific parsing knowledge.

## Semantic IDs

Examples:

- `file:src/auth/session.ts`
- `component:ProjectCard@components/ProjectCard.tsx`
- `route:/api/projects`
- `action:POST@app/api/projects/route.ts`
- `provider:package/react`
- `state:react/useState@components/ProjectCard.tsx`

## Baselines and drift

`senten baseline accept` records an explicitly accepted architecture baseline.

`senten drift` compares a fresh source discovery against that baseline. Additions, removals, node changes and relationship changes are reported. Removal of actions, routes, policies, invariants and resources is initially classified as potentially breaking.

`senten drift --strict` returns a failing process status when meaningful drift is found, allowing CI/workflows to gate changes.

## Semantic diff

`senten diff --against <baseline>` compares the current discovered StateTruss to a stored baseline. `previous` is automatically captured when an explicit `senten discover` replaces the current graph.

## Safety

Static discovery does not execute repository code, lifecycle scripts, framework loaders or user configuration. Dynamic discovery belongs in the Sandbox Engine and requires explicit authorization.

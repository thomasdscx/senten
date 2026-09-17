# Senten Extension Protocol v0.3

## Status

Alpha protocol marker for Senten `0.21.1-alpha.0`. It is intentionally versioned and not yet frozen as a 1.0 compatibility promise.

## Purpose

Extensions teach Senten framework/runtime semantics without coupling framework-specific logic to Senten Core. Adapters and integrations declare minimum capabilities; undeclared authority is unavailable.

## Application IR Fragment SPI

Source analyzers should prefer emitting an `ApplicationIRFragment`:

```ts
{
  schemaVersion: '0.1',
  applicationId?: 'my-app',
  nodes: [...],
  edges: [...],
  evidence?: [...],
  diagnostics?: [...],
  frameworkHints?: ['next'],
  source: {
    adapter: 'next',
    adapterVersion: '0.21.1-alpha.0',
    analyzer: 'next.source',
    files: ['app/projects/page.tsx'],
    confidence: 'high'
  }
}
```

Senten validates each fragment before merge. Merge order is deterministic by adapter identity/version. Semantic IDs are stable. A fragment cannot silently change the kind of an existing semantic identity. Unresolved edges are reported as diagnostics instead of causing the graph to invent missing nodes.

Provenance is attached to merged nodes and edges as `irFragmentProvenance` so later inspection can explain which adapter contributed the semantic fact.

Legacy `{ nodes, edges, frameworkHints }` analyzer contributions remain accepted during the alpha migration window.

## First-party reference adapters

Senten ships reference adapters for:

- React
- Next.js
- Expo
- Tauri

The Next.js, Expo, and Tauri adapters exercise the IR Fragment SPI directly.

## Commands and machine tools

Extension commands remain registered through the same extension manifest. MCP exposure is derived from the central Senten command surface. Extension commands are considered mutating/privileged by default for MCP and are not exposed by the read-only default server.

## Security

An extension manifest is not an authority grant. Package integrity, publisher trust, compatibility, and runtime capability policy remain separate decisions. Community extension execution should be sandboxed/isolated as the registry ecosystem matures; static inspection must not imply safe execution.

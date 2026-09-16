# Senten Extension Protocol v0.1

## 1. Purpose

Senten extensions let external ecosystems teach Senten about their semantics, commands, runtime behavior, interactions, and tooling without requiring Senten Core changes.

## 2. Categories

### Adapter
Teaches Senten about a framework/runtime ecosystem.

### Integration
Connects Senten to an external tool/service/provider.

### Hybrid
May do both where appropriate.

## 3. Minimal Extension

```ts
export default defineSentenExtension({
  name: "example",
  namespace: "example",
  type: "adapter",
  version: "0.1.0",
  sentenRange: ">=0.1.0"
});
```

## 4. Command Registration

```ts
commands({ command }) {
  command("component inspect")
    .argument("<name>")
    .description("Inspect a framework component")
    .handler(inspectComponent);
}
```

## 5. Semantic Registration

```ts
semantic({ register }) {
  register(ComponentAnalyzer);
  register(RouteAnalyzer);
  register(StateAnalyzer);
}
```

## 6. Universal Element Registration

Extensions may register element kinds such as:

```text
react-component
vue-sfc
flutter-widget
django-view
rails-controller
```

Element kinds must provide resolution and serialization rules.

## 7. Lifecycle Hooks

Supported hook families:

```text
discovery
compile
graph
execution
commit
sandbox
proof
report
interaction
```

## 8. Capability Manifest

Extensions declare minimum required authority.

```json
{
  "capabilities": [
    "source.read",
    "semantic.write"
  ]
}
```

Undeclared capabilities are unavailable.

## 9. Machine Tool Exposure

Command definitions may opt into MCP/tool exposure using the same argument and output schemas.

## 10. Observatory Contributions

Extensions may contribute views/panels through a declarative UI extension contract without gaining unrestricted GUI execution authority.

## 11. Compatibility Suite

Senten should publish a community compatibility test suite validating:

- manifest schema;
- command schemas;
- capability declarations;
- semantic output stability;
- element resolution;
- sandbox behavior;
- machine-tool schemas;
- extension lifecycle behavior.

## 12. Registry Protocol

The registry protocol must be open and allow community/self-hosted registries. Senten Core should not require a proprietary cloud registry.

# Senten MCP stdio transport v0.1

Senten `0.21.1-alpha.0` provides a real JSON-RPC stdio MCP transport.

```bash
senten mcp schema
senten mcp serve
```

The default server exposes only read-oriented architecture tools. Mutating tools require an explicit operator decision:

```bash
senten mcp serve --allow-write
```

Commands that request `--allow-live-effects` are still denied unless the server itself was started with the additional explicit gate:

```bash
senten mcp serve --allow-write --allow-live-effects
```

That second flag should only be used in an explicitly authorized non-production environment.

## Implemented protocol surface

- `initialize`
- `ping`
- `tools/list`
- `tools/call`
- notifications are accepted without replies
- newline-delimited JSON-RPC over stdio
- request size bound
- tool timeout
- output size bound
- shell-free child process execution

Supported negotiated protocol versions currently include `2025-06-18` and `2024-11-05`; unsupported client requests fall back to the newest supported transport version.

## Security posture

MCP transport does not bypass Senten's own project, sandbox, or capability boundaries. Read-only-by-default is deliberate. `--allow-write` exposes command capability, not production credentials. Live external effects require the separate `--allow-live-effects` gate and remain subject to the invoked command's own safety checks.

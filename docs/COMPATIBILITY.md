# Senten compatibility boundary

Senten `1.0.0-rc.1` marks the first candidate-frozen v1 protocol boundary. The RC exists to prove these contracts against real applications before stable `1.0.0`.

Current protocol markers:

- Application IR: `0.1` (language-neutral semantic representation; schema remains separately versioned)
- Command schema: `1.0-rc1`
- Extension protocol: `1.0-rc1`
- Registry protocol: `1.0-rc1`
- Local state: migration-managed SQLite schema (`10` at RC1)

Run `senten compatibility` to inspect the active boundary. Breaking protocol changes after RC1 require an explicit compatibility marker change and a migration or incompatibility result.

Senten semantic paths are platform-neutral and use `/`. Host-specific path, process, browser, container, credential and package-manager behavior belongs in adapters/providers.

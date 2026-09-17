# Capability Runtime

Senten models application needs as capabilities rather than vendor SDKs. A capability can have multiple providers with explicit health, priority and operational budgets.

Examples:

```text
senten capability register ai local-llm --priority 100
senten capability register ai remote-provider --priority 50
senten capability budget ai --latency-ms 1500 --tokens 4000 --cost-usd 0.10
senten capability check ai --latency-ms 700 --tokens 900
```

The runtime selects the highest-priority healthy provider. A degraded-only provider fails closed unless the caller explicitly allows degraded execution. Budgets can constrain latency, calls, cost and token use.

The built-in capability registry is an architecture/runtime contract; it does not silently rewrite application imports or transmit credentials.

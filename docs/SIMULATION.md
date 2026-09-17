# Safe simulation

`senten simulate` records deterministic failure-injection plans without modifying production systems.

```text
senten simulate provider --target capability:ai --value unavailable
senten simulate latency --target capability:database --value 1500ms
senten simulate list
senten simulate inspect <id>
```

Simulation plans are stored under `.senten/simulations/` and are declarative. Actual fault execution must occur through an isolated sandbox/provider. Senten never represents a declarative plan as proof that a fault was executed.

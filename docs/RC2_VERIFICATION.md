# Senten 1.0.0-rc.2 verification

RC2 adds project-declared architecture manifests, a controlled Scenario Lab, and static Showcase artifacts generated from real Senten analysis.

Release gate:

- full typecheck/build/test preflight
- controlled scenario corpus passes
- showcase artifacts generate without failed scenarios
- Senten self-model retains declared policies and invariants through discovery
- Windows/macOS/Linux and Docker CI must pass before publication

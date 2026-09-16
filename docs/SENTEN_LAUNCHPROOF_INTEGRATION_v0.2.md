# Senten ↔ LaunchProof Native Assurance Integration v0.2

Status: implemented in Senten `0.9.0-alpha.0`.

## Purpose

Senten describes application intent, architecture, policies, invariants, runtime observations and accumulated evidence. LaunchProof independently verifies whether those claims are actually supported.

The boundary is deliberately asymmetric:

```text
Senten
  declares claims + exports evidence
          ↓
Senten Assurance Exchange v0.1
          ↓
LaunchProof
  performs independent analysis
          ↓
LaunchProof Verification Result v0.1
          ↓
Senten
  validates provenance + imports verification evidence
```

Senten never upgrades its own declaration or runtime observation to independent verification.

## Evidence ladder

- `declared` — architecture says a claim should be true.
- `observed` — runtime behavior was observed.
- `tested` — deterministic test/verifier evidence supports the claim.
- `verified` — independent trusted verification supports the claim.
- `failed` — material evidence contradicts the claim.

A LaunchProof result that is unsigned, or signed by a key not trusted by the current Senten project, is accepted only as **tested** evidence. A valid signature whose key is trusted through the Senten trust store can produce **verified** evidence.

## Export

```bash
senten launchproof export
senten launchproof export --subject invariant:tenant-isolation
senten launchproof export --output artifacts/release.assurance.json
```

The exchange contains:

- application identity;
- StateTruss digest;
- stable assurance claim IDs;
- sanitized supporting evidence;
- evidence provenance policy;
- SHA-256 content digest.

Sensitive metadata keys such as secrets, passwords, tokens, credentials and private keys are redacted during exchange creation.

## Import

```bash
senten launchproof import launchproof-result.json
```

If the source exchange is not in local Senten exchange history:

```bash
senten launchproof import launchproof-result.json \
  --source release.assurance.json
```

Senten rejects a result if:

- its source bundle ID does not match;
- its source bundle digest does not match;
- it references unknown claims;
- a claim subject differs from the exported claim;
- a supplied Ed25519 signature is invalid.

## Trust

LaunchProof can sign verification result bundles using Ed25519. The public verification key is added to Senten using the same local trust system used by the extension ecosystem:

```bash
senten trust add launchproof.public.pem --publisher launchproof
```

Trust is local/team controlled. Senten does not depend on a centralized trust service.

## Assurance Cases

Senten Assurance Cases group claims and derive their status from evidence.

```bash
senten assurance claims
senten assurance case create tenant-boundary \
  --claim invariant:tenant-isolation \
  --claim policy:tenant-access
senten assurance case evaluate tenant-boundary
senten assurance case list
```

Case status is conservative:

- `verified` — every claim is independently verified;
- `supported` — all claims are at least tested/supported;
- `failed` — any claim currently fails;
- `incomplete` — evidence is missing or weaker than required.

## Reports

```bash
senten report assurance --format html
senten report assurance --format md
senten report assurance --format json
```

The canonical project snapshot now includes LaunchProof exchanges, result bundles, trusted verification evidence and Assurance Case state.

## Security properties

1. Exporting does not execute repository code.
2. Exchange integrity is bound to a stable digest.
3. Verification results are bound to the exact exported bundle digest.
4. Unsigned/untrusted verification cannot create strength-4 evidence.
5. Manual `senten evidence add --status verified` is rejected.
6. Historic failed evidence remains in the ledger even after later successful verification.
7. Unknown does not become passed.

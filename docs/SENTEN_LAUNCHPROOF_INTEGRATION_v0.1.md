# Senten ↔ LaunchProof Native Integration v0.1

## 1. Purpose

Senten and LaunchProof are complementary systems.

**Senten** defines, constrains, executes, explains, and observes application architecture.

**LaunchProof** independently inspects application evidence and determines whether release/security/readiness claims are actually supported.

The relationship is deliberately asymmetric: Senten may declare what should be true; LaunchProof should independently verify what is evidenced to be true.

## 2. Architectural Flow

```text
Human / Agent Intent
       ↓
Senten Semantic Architecture
       ↓
Implementation
       ↓
Senten Tests / Interaction / Sandbox / Runtime Evidence
       ↓
LaunchProof Independent Analysis
       ↓
Verified / Failed / Unknown Assurance Claims
       ↓
Senten Evidence Engine
       ↓
Observatory / Reports / Promotion Gate
```

## 3. Native Integration Namespace

Proposed CLI:

```bash
senten launchproof inspect
senten launchproof verify
senten launchproof release
senten proof --provider launchproof
senten guarantee tenant-isolation --provider launchproof
```

## 4. Senten → LaunchProof Inputs

Senten may export:

- Application IR snapshot;
- Semantic Graph snapshot;
- Universal Element map;
- declared invariants;
- policy definitions;
- capability/effect declarations;
- environment contracts;
- interaction/clickthrough results;
- journey results;
- sandbox evidence;
- build/test evidence;
- runtime observation summaries;
- provenance and operation history;
- agent change bundles.

## 5. LaunchProof → Senten Results

LaunchProof may return:

- assurance case results;
- claim status: PASS / FAIL / UNKNOWN / INCOMPLETE;
- evidence references;
- release decision;
- security findings;
- architecture findings;
- accessibility findings;
- production-readiness findings;
- policy failures;
- provenance metadata.

## 6. Evidence Ingestion

Senten records LaunchProof results as external evidence:

```text
provider: launchproof
source: independent-analysis
immutable-result-id: ...
semantic-target: invariant:tenant-isolation
```

Senten should never rewrite a LaunchProof result to make it appear native or stronger than the source result.

## 7. Promotion Gate

Senten may define a promotion policy such as:

```yaml
promotion:
  staging_to_production:
    require:
      - senten.check
      - senten.clickthru:critical
      - launchproof.release:pass
```

LaunchProof remains optional; teams may substitute another assurance provider if they implement the Senten assurance integration contract.

## 8. Observatory

Observatory may render LaunchProof findings beside Senten declarations:

```text
Invariant: tenant-isolation
Declared by Senten: YES
Static evidence: PASS
Runtime evidence: PASS
LaunchProof independent verification: PASS
Overall status: VERIFIED
```

Unknown/partial evidence must remain visible.

## 9. Design Principle

> Senten defines and gathers. LaunchProof independently proves.

## Build 6 implementation note

Senten `0.6.0-alpha.0` now persists runtime observations and evidence records locally and can export the evidence ledger with:

```bash
senten evidence export --output evidence.json
```

This is the first concrete interchange surface for the future LaunchProof adapter. Evidence imported from runtime/interaction systems retains subject, source, status, timestamp, environment and provenance metadata. LaunchProof verification should contribute new verification evidence rather than mutating or replacing Senten's original observations.

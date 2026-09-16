import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import type {
  AssuranceExchangeBundle,
  EvidenceRecord,
  LaunchProofResultBundle
} from '../../../packages/core/src/index.js';
import { defineSentenExtension } from '../../../packages/extension-sdk/src/index.js';
import { sha256Json, stableJson, validateAssuranceExchange } from '../../../packages/assurance/src/index.js';
import { keyIdFromPublicKey, type TrustStore } from '../../../packages/package-security/src/index.js';

export interface LaunchProofImportResult {
  accepted: boolean;
  trusted: boolean;
  errors: string[];
  warnings: string[];
  evidence: EvidenceRecord[];
}

function resultSigningPayload(result: LaunchProofResultBundle): Buffer {
  const clone = { ...result, signature: undefined };
  return Buffer.from(stableJson(clone),'utf8');
}

export function signLaunchProofResult(result: LaunchProofResultBundle, privateKey: string, publisher = 'launchproof'): LaunchProofResultBundle {
  const { signature: _signature, ...base } = result;
  const publicKey=createPublicKey(privateKey).export({format:'pem',type:'spki'}).toString();
  const keyId=keyIdFromPublicKey(publicKey);
  const payload=resultSigningPayload(base);
  const signedDigest=createHash('sha256').update(payload).digest('hex');
  return {...base,signature:{algorithm:'ed25519',keyId,publisher,publicKey,signature:sign(null,payload,privateKey).toString('base64'),signedDigest,createdAt:new Date().toISOString()}};
}

export function verifyLaunchProofResultTrust(result: LaunchProofResultBundle, trust?: TrustStore): {valid:boolean;trusted:boolean;errors:string[]} {
  const sig=result.signature;
  if(!sig) return {valid:false,trusted:false,errors:[]};
  const errors:string[]=[];
  try{
    if(sig.algorithm!=='ed25519')errors.push(`Unsupported LaunchProof signature algorithm: ${sig.algorithm}`);
    const keyId=keyIdFromPublicKey(sig.publicKey);if(keyId!==sig.keyId)errors.push('LaunchProof signature key id mismatch.');
    const digest=createHash('sha256').update(resultSigningPayload(result)).digest('hex');if(digest!==sig.signedDigest)errors.push('LaunchProof signed digest mismatch.');
    if(!verify(null,resultSigningPayload(result),sig.publicKey,Buffer.from(sig.signature,'base64')))errors.push('LaunchProof signature is invalid.');
    const valid=errors.length===0;
    const trusted=valid&&Boolean(trust?.keys.some(k=>k.keyId===sig.keyId&&(!k.publisher||!sig.publisher||k.publisher===sig.publisher)));
    return{valid,trusted,errors};
  }catch(error){return{valid:false,trusted:false,errors:[`LaunchProof signature verification error: ${error instanceof Error?error.message:String(error)}`]};}
}

export function validateLaunchProofResult(result: LaunchProofResultBundle, source: AssuranceExchangeBundle): string[] {
  const errors = validateAssuranceExchange(source);
  if (result.schemaVersion !== '0.1') errors.push(`Unsupported LaunchProof result schema: ${result.schemaVersion}`);
  if (result.kind !== 'launchproof-verification-result') errors.push('Invalid LaunchProof result kind.');
  if (result.verifier?.name !== 'LaunchProof') errors.push('Result verifier is not LaunchProof.');
  if (result.sourceBundleId !== source.id) errors.push('LaunchProof result references a different assurance bundle id.');
  if (result.sourceBundleDigest !== source.digest) errors.push('LaunchProof result references a different assurance bundle digest.');
  const claims = new Map(source.claims.map(c => [c.id,c]));
  const seen = new Set<string>();
  for (const row of result.results) {
    if (seen.has(row.claimId)) errors.push(`Duplicate LaunchProof claim result: ${row.claimId}`);
    seen.add(row.claimId);
    const claim = claims.get(row.claimId);
    if (!claim) errors.push(`LaunchProof result references unknown claim: ${row.claimId}`);
    else if (row.subject !== claim.subject) errors.push(`LaunchProof result subject mismatch for ${row.claimId}.`);
  }
  return [...new Set(errors)];
}

export function launchProofResultToEvidence(result: LaunchProofResultBundle, source: AssuranceExchangeBundle, trust?: TrustStore): LaunchProofImportResult {
  const errors = validateLaunchProofResult(result, source);
  const signature=verifyLaunchProofResultTrust(result,trust);
  if(signature.errors.length)errors.push(...signature.errors);
  if (errors.length) return { accepted:false, trusted:false, errors:[...new Set(errors)], warnings:[], evidence:[] };
  const warnings:string[]=[];
  if(!result.signature)warnings.push('LaunchProof result is unsigned; verified outcomes are imported as tested evidence, not independent verification.');
  else if(!signature.trusted)warnings.push('LaunchProof signature is valid but its key is not trusted; verified outcomes are imported as tested evidence.');
  const claimMap = new Map(source.claims.map(c => [c.id,c]));
  const evidence: EvidenceRecord[] = result.results.map(row => {
    const claim = claimMap.get(row.claimId)!;
    const status: EvidenceRecord['status'] = row.outcome === 'verified' ? (signature.trusted?'verified':'tested') : row.outcome === 'failed' ? 'failed' : 'unknown';
    return {
      id: `ev_lp_${createHash('sha256').update(`${result.id}|${row.claimId}|${row.outcome}`).digest('hex').slice(0,16)}`,
      subject: claim.subject,
      claim: row.reason ?? `LaunchProof ${row.outcome} assurance claim ${row.claimId}`,
      source: `launchproof:${result.verifier.executionId ?? result.id}`,
      status,
      timestamp: result.generatedAt,
      evidenceType: status==='verified'?'verification':'test',
      strength: status === 'verified' ? 4 : status==='tested'?3:0,
      provenance: {
        verifier: 'LaunchProof',
        verifierVersion: result.verifier.version,
        executionId: result.verifier.executionId,
        sourceBundleId: source.id,
        sourceBundleDigest: source.digest,
        resultBundleId: result.id,
        resultDigest: sha256Json(result),
        signatureValid: signature.valid,
        publisherTrusted: signature.trusted,
        signatureKeyId: result.signature?.keyId
      },
      metadata: {
        launchProofOutcome: row.outcome,
        launchProofClaimId: row.claimId,
        evidenceRefs: row.evidenceRefs ?? [],
        checks: row.checks ?? [],
        ...(row.metadata ?? {})
      }
    };
  });
  return { accepted:true, trusted:signature.trusted, errors:[], warnings, evidence };
}

export const launchProofIntegration = defineSentenExtension({
  name: 'Senten LaunchProof Integration',
  namespace: 'launchproof',
  version: '0.11.0-alpha.0',
  kind: 'integration',
  senten: '>=0.9.0-alpha.0',
  capabilities: ['semantic.read', 'evidence.read', 'evidence.write'],
  semanticTypes: ['claim', 'evidence', 'guarantee'],
  commands: [
    { path:'export', description:'Export Senten assurance claims and evidence for independent LaunchProof verification.', capability:'evidence.read', run:async()=>{} },
    { path:'import', description:'Import independently verified LaunchProof results into the Senten evidence ledger.', capability:'evidence.write', run:async()=>{} },
    { path:'status', description:'Inspect Senten ↔ LaunchProof assurance exchange history.', capability:'evidence.read', run:async()=>{} }
  ]
});

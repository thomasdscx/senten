import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ApplicationIR, LaunchProofResultBundle } from '../packages/core/src/index.js';
import { createAssuranceCase, createAssuranceExchange, evaluateAssuranceCase, extractAssuranceClaims, validateAssuranceExchange } from '../packages/assurance/src/index.js';
import { launchProofResultToEvidence, signLaunchProofResult } from '../integrations/launchproof/src/index.js';
import { generateSigningKey, loadTrustStore, trustPublicKey } from '../packages/package-security/src/index.js';
import { LocalStateStore } from '../packages/local-state/src/index.js';

const ir:ApplicationIR={
  schemaVersion:'0.1',application:{id:'app',name:'App'},generatedAt:'2026-09-15T00:00:00.000Z',
  nodes:[
    {id:'invariant:tenant-isolation',kind:'invariant',label:'Tenant isolation'},
    {id:'policy:admin-write',kind:'policy',label:'Admin write'},
    {id:'action:project.create',kind:'action',label:'Create project'}
  ],edges:[]
};

function resultFor(bundle:ReturnType<typeof createAssuranceExchange>):LaunchProofResultBundle{
  const claim=bundle.claims[0]!;
  return {schemaVersion:'0.1',kind:'launchproof-verification-result',id:'lp_result_1',generatedAt:'2026-09-15T01:00:00.000Z',sourceBundleId:bundle.id,sourceBundleDigest:bundle.digest,verifier:{name:'LaunchProof',version:'0.2.0',executionId:'lp_run_1'},results:[{claimId:claim.id,subject:claim.subject,outcome:'verified',reason:'Independent deterministic checks passed.'}]};
}

test('assurance exchange has stable integrity and explicit claims',()=>{
  const bundle=createAssuranceExchange({sentenVersion:'0.9.0-alpha.0',ir,evidence:[]});
  assert.equal(validateAssuranceExchange(bundle).length,0);
  assert.equal(bundle.claims.length,3);
  const tampered={...bundle,claims:[...bundle.claims,{...bundle.claims[0]!,id:'tampered'}]};
  assert.ok(validateAssuranceExchange(tampered).some(e=>e.includes('digest mismatch')));
});

test('unsigned LaunchProof verified result is downgraded to tested evidence',()=>{
  const bundle=createAssuranceExchange({sentenVersion:'0.9.0-alpha.0',ir,evidence:[]});
  const imported=launchProofResultToEvidence(resultFor(bundle),bundle);
  assert.equal(imported.accepted,true);
  assert.equal(imported.trusted,false);
  assert.equal(imported.evidence[0]!.status,'tested');
  assert.equal(imported.evidence[0]!.strength,3);
  assert.ok(imported.warnings.length>0);
});

test('trusted signed LaunchProof result becomes independently verified evidence',async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-launchproof-'));
  try{
    const bundle=createAssuranceExchange({sentenVersion:'0.9.0-alpha.0',ir,evidence:[]});
    const keys=await generateSigningKey(join(root,'keys'),'launchproof');
    const privateKey=await readFile(keys.privateKeyPath,'utf8');
    const signed=signLaunchProofResult(resultFor(bundle),privateKey,'launchproof');
    await trustPublicKey(root,keys.publicKeyPath,'launchproof');
    const trust=await loadTrustStore(root);
    const imported=launchProofResultToEvidence(signed,bundle,trust);
    assert.equal(imported.accepted,true);
    assert.equal(imported.trusted,true);
    assert.equal(imported.evidence[0]!.status,'verified');
    assert.equal(imported.evidence[0]!.strength,4);
    assert.equal(imported.evidence[0]!.provenance?.verifier,'LaunchProof');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('LaunchProof result bound to another assurance digest is rejected',()=>{
  const bundle=createAssuranceExchange({sentenVersion:'0.9.0-alpha.0',ir,evidence:[]});
  const result={...resultFor(bundle),sourceBundleDigest:'wrong'};
  const imported=launchProofResultToEvidence(result,bundle);
  assert.equal(imported.accepted,false);
  assert.ok(imported.errors.some(e=>e.includes('digest')));
});

test('Assurance Case status is derived from guarantee evidence and persists locally',async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-case-'));
  try{
    const claims=extractAssuranceClaims(ir).filter(c=>c.kind==='invariant');
    const rec=createAssuranceCase('tenant-boundary',claims.map(c=>c.id));
    const evidence=[{id:'ev_verified',subject:'invariant:tenant-isolation',claim:'verified',source:'launchproof:run',status:'verified' as const,strength:4 as const,timestamp:'2026-09-15T02:00:00.000Z',evidenceType:'verification' as const}];
    const evaluated=evaluateAssuranceCase(rec,extractAssuranceClaims(ir),evidence,ir);
    assert.equal(evaluated.status,'verified');
    const store=await LocalStateStore.open(root);store.putAssuranceCase(evaluated);assert.equal(store.getAssuranceCase(evaluated.id)?.status,'verified');store.close();
  }finally{await rm(root,{recursive:true,force:true});}
});

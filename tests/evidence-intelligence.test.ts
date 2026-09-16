import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ApplicationIR, EvidenceRecord, RuntimeObservationRecord } from '../packages/core/src/index.js';
import { defineContract } from '../packages/contracts/src/index.js';
import { defineAction, defineInvariant, ExecutionEngine } from '../packages/runtime/src/index.js';
import { LocalStateStore } from '../packages/local-state/src/index.js';
import { evaluateGuarantee, observationToEvidence, runtimeAlignment, summarizeEvidence } from '../packages/evidence-intelligence/src/index.js';

const ir: ApplicationIR = {
  schemaVersion:'0.1', application:{id:'app',name:'App'}, generatedAt:new Date().toISOString(),
  nodes:[
    {id:'action:invoice.create',kind:'action'},
    {id:'invariant:invoice.nonnegative',kind:'invariant'},
    {id:'policy:invoice.create',kind:'policy'}
  ], edges:[]
};

test('runtime observations become evidence with deterministic strength', () => {
  const observation:RuntimeObservationRecord={id:'obs_1',kind:'invariant',subject:'invariant:invoice.nonnegative',status:'passed',timestamp:'2026-01-01T00:00:00.000Z',environment:'test',source:'test'};
  const evidence=observationToEvidence(observation);
  assert.equal(evidence.status,'observed');
  assert.equal(evidence.strength,2);
  assert.equal(evidence.subject,'invariant:invoice.nonnegative');
});

test('failed evidence dominates a guarantee', () => {
  const records:EvidenceRecord[]=[
    {id:'a',subject:'invariant:invoice.nonnegative',claim:'declared',source:'test',status:'verified',strength:4,timestamp:'2026-01-01T00:00:00.000Z'},
    {id:'b',subject:'invariant:invoice.nonnegative',claim:'runtime failure',source:'runtime',status:'failed',strength:0,timestamp:'2026-01-02T00:00:00.000Z'}
  ];
  const result=evaluateGuarantee('invariant:invoice.nonnegative',records,ir);
  assert.equal(result.status,'failed');
});


test('newer positive evidence can supersede a historical failure while preserving history', () => {
  const records:EvidenceRecord[]=[
    {id:'f',subject:'invariant:invoice.nonnegative',claim:'failed yesterday',source:'runtime',status:'failed',strength:0,timestamp:'2026-01-01T00:00:00.000Z'},
    {id:'v',subject:'invariant:invoice.nonnegative',claim:'verified after fix',source:'launchproof',status:'verified',strength:4,timestamp:'2026-01-02T00:00:00.000Z'}
  ];
  const result=evaluateGuarantee('invariant:invoice.nonnegative',records,ir);
  assert.equal(result.status,'verified');
  assert.equal(result.evidence.length,2);
});

test('runtime alignment reports runtime-only and unobserved semantics', () => {
  const observations:RuntimeObservationRecord[]=[
    {id:'o1',kind:'action',subject:'action:invoice.create',status:'passed',timestamp:'2026-01-01T00:00:00.000Z',environment:'test',source:'test'},
    {id:'o2',kind:'action',subject:'action:runtime.only',status:'observed',timestamp:'2026-01-01T00:00:01.000Z',environment:'test',source:'test'}
  ];
  const report=runtimeAlignment(ir,observations);
  assert.equal(report.matched,1);
  assert.deepEqual(report.runtimeOnly,['action:runtime.only']);
  assert(report.unobserved.includes('invariant:invoice.nonnegative'));
});

test('local state persists runtime observations, traces, and evidence', async () => {
  const root=await mkdtemp(join(tmpdir(),'senten-evidence-'));
  try{
    const store=await LocalStateStore.open(root);
    const observation:RuntimeObservationRecord={id:'obs_x',traceId:'trace_x',kind:'action',subject:'action:invoice.create',status:'passed',timestamp:'2026-01-01T00:00:00.000Z',environment:'test',source:'test'};
    const evidence=observationToEvidence(observation);
    store.putRuntimeObservation(observation);
    store.putEvidence(evidence);
    assert.equal(store.listRuntimeObservations({subject:'action:invoice.create'}).length,1);
    assert.equal(store.listEvidence({subject:'action:invoice.create'}).length,1);
    store.close();
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('execution engine emits runtime and evidence observations', async () => {
  const runtime:RuntimeObservationRecord[]=[];
  const evidence:EvidenceRecord[]=[];
  const engine=new ExecutionEngine(undefined,{runtime:{record(v){runtime.push(v);}},evidence:{record(v){evidence.push(v);}}});
  const action=defineAction({
    id:'invoice.create',
    input:defineContract('CreateInvoice',input=>input as {total:number}),
    invariants:[defineInvariant<{total:number}>('invoice.nonnegative',value=>value.total>=0)],
    handler(input){return input;}
  });
  const result=await engine.execute(action,{total:2},{environment:'test'});
  assert.equal(result.value.total,2);
  assert(runtime.some(r=>r.kind==='invariant'&&r.status==='passed'));
  assert(evidence.some(e=>e.subject==='invariant:invoice.nonnegative'&&e.status==='tested'));
});

test('evidence summaries preserve failed counts without inflating strength', () => {
  const summary=summarizeEvidence([
    {id:'1',claim:'x',source:'a',status:'observed',strength:2,timestamp:'2026-01-01T00:00:00.000Z'},
    {id:'2',claim:'x',source:'b',status:'failed',strength:0,timestamp:'2026-01-02T00:00:00.000Z'}
  ]);
  assert.equal(summary.failed,1);
  assert.equal(summary.strongest,'failed');
  assert.equal(summary.strength,2);
});

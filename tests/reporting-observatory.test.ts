import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ApplicationIR, EvidenceRecord, RuntimeObservationRecord, SentenConfig } from '../packages/core/src/index.js';
import { LocalStateStore } from '../packages/local-state/src/index.js';
import { collectProjectSnapshot, renderReport, writeReport } from '../packages/reporting/src/index.js';
import { startObservatory } from '../packages/observatory/src/index.js';

async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'senten-report-')); await mkdir(join(root,'.senten'),{recursive:true});
  const config:SentenConfig={application:{id:'demo',name:'Demo'},environment:'test'};
  const ir:ApplicationIR={schemaVersion:'0.1',application:{id:'demo',name:'Demo'},generatedAt:new Date().toISOString(),nodes:[{id:'invariant:tenant-isolation',kind:'invariant'},{id:'action:project.create',kind:'action'}],edges:[{from:'action:project.create',to:'invariant:tenant-isolation',relation:'preserves'}]};
  await writeFile(join(root,'senten.config.json'),JSON.stringify(config));await writeFile(join(root,'.senten','state-truss.json'),JSON.stringify(ir));
  const store=await LocalStateStore.open(root);const obs:RuntimeObservationRecord={id:'obs_1',kind:'invariant',subject:'invariant:tenant-isolation',status:'passed',timestamp:new Date().toISOString(),environment:'test',source:'test'};const ev:EvidenceRecord={id:'ev_1',subject:'invariant:tenant-isolation',claim:'tenant isolation tested',source:'test',status:'tested',strength:3,timestamp:new Date().toISOString()};store.putRuntimeObservation(obs);store.putEvidence(ev);store.close();return root;
}

test('canonical snapshot joins architecture runtime and evidence',async()=>{const root=await fixture();try{const s=await collectProjectSnapshot(root);assert.equal(s.application.name,'Demo');assert.equal(s.architecture.nodes,2);assert.equal(s.runtime.observations,1);assert.equal(s.evidence.guarantees[0]?.status,'supported');}finally{await rm(root,{recursive:true,force:true});}});

test('report renderers produce portable json markdown and html',async()=>{const root=await fixture();try{const s=await collectProjectSnapshot(root);assert.match(renderReport(s,'json'),/tenant-isolation/);assert.match(renderReport(s,'md'),/Senten Project Report/);assert.match(renderReport(s,'html'),/<!doctype html>/);const rec=await writeReport(root,{kind:'evidence',format:'md'});assert.match(await readFile(join(root,rec.path),'utf8'),/Guarantees/);const store=await LocalStateStore.open(root);assert.equal(store.listReports().length,1);store.close();}finally{await rm(root,{recursive:true,force:true});}});

test('Observatory serves local read-only snapshot APIs',async()=>{const root=await fixture();let server:Awaited<ReturnType<typeof startObservatory>>|undefined;try{server=await startObservatory(root,{port:0});const health=await fetch(server.url+'/health').then(r=>r.json()) as {status:string};assert.equal(health.status,'ok');const snapshot=await fetch(server.url+'/api/snapshot').then(r=>r.json()) as {application:{name:string}};assert.equal(snapshot.application.name,'Demo');const page=await fetch(server.url).then(r=>r.text());assert.match(page,/Senten Observatory/);}finally{if(server)await server.close();await rm(root,{recursive:true,force:true});}});

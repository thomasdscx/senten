import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ApplicationIR, SandboxRecord } from '../packages/core/src/index.js';
import { mergeApplicationIRFragments } from '../packages/semantic/src/index.js';
import { defineApplicationIRFragment } from '../packages/extension-sdk/src/index.js';
import { validateMcpArguments, redactMcpOutput } from '../packages/mcp/src/index.js';
import { sandboxBoundaryReport, assertSandboxEffectBoundary } from '../packages/sandbox/src/index.js';
import { analyzeAdoption } from '../packages/adoption/src/index.js';

const base:ApplicationIR={schemaVersion:'0.1',application:{id:'demo',name:'Demo'},nodes:[{id:'file:src/a.ts',kind:'file',label:'A',source:'src/a.ts'}],edges:[],generatedAt:new Date().toISOString()};

test('Build 22 deterministic IR merge preserves canonical identity on same-kind adapter conflict',()=>{
  const a=defineApplicationIRFragment({schemaVersion:'0.1',nodes:[{id:'route:/x',kind:'route',label:'Canonical',source:'src/a.ts'}],edges:[],source:{adapter:'a',adapterVersion:'1.0.0'}});
  const b=defineApplicationIRFragment({schemaVersion:'0.1',nodes:[{id:'route:/x',kind:'route',label:'Alternate',source:'src/b.ts'}],edges:[],source:{adapter:'b',adapterVersion:'1.0.0'}});
  const merged=mergeApplicationIRFragments(base,[b,a]);
  const node=merged.ir.nodes.find(n=>n.id==='route:/x');
  assert.equal(node?.label,'Canonical');
  assert.equal(node?.source,'src/a.ts');
  assert.ok(merged.diagnostics.some(d=>d.code==='fragment.semantic-conflict'));
  assert.equal((node?.metadata?.irFragmentProvenance as unknown[]).length,2);
});

test('Build 23 MCP project scope blocks secrets and external absolute paths',()=>{
  const cwd=process.cwd();
  assert.equal(validateMcpArguments(cwd,['inspect','file:.env']).ok,false);
  assert.equal(validateMcpArguments(cwd,['inspect',join(cwd,'src','index.ts')]).ok,true);
  const outside=process.platform==='win32'?'C:\\outside\\secret.txt':'/outside/secret.txt';
  assert.equal(validateMcpArguments(cwd,['inspect',outside]).ok,false);
});

test('Build 23 MCP output redaction masks credential-like assignments and private keys',()=>{
  const text='API_TOKEN=abc123 PASSWORD: hunter2\n-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----';
  const redacted=redactMcpOutput(text);
  assert.doesNotMatch(redacted,/abc123|hunter2|\nsecret\n/);
  assert.match(redacted,/API_TOKEN=<redacted>/);
  assert.match(redacted,/<redacted-private-key>/);
});

test('Build 24 Docker sandbox boundary report exposes enforced containment properties',()=>{
  const record:SandboxRecord={id:'s',provider:'docker',isolation:'container',root:'/tmp/s',projectRoot:'/tmp',environmentName:'sandbox',network:'deny',status:'active',createdAt:new Date().toISOString(),containerId:'senten-s'};
  const report=sandboxBoundaryReport(record);
  assert.equal(report.network,'denied');
  assert.equal(report.process,'container');
  assert.equal(report.rootFilesystem,'read-only');
  assert.equal(report.privilegeEscalation,'blocked');
  assert.equal(report.confidence,'high');
  assert.equal(assertSandboxEffectBoundary(record,{command:'node',effectIntent:'mutating'}).mode,'contained-mutation');
});

test('Build 24 local sandbox never overstates host-process containment',()=>{
  const record:SandboxRecord={id:'s',provider:'local',isolation:'workspace-copy',root:'/tmp/s',projectRoot:'/tmp',environmentName:'sandbox',network:'inherit',status:'active',createdAt:new Date().toISOString()};
  const report=sandboxBoundaryReport(record);
  assert.equal(report.process,'host');
  assert.equal(report.confidence,'low');
  assert.throws(()=>assertSandboxEffectBoundary(record,{command:'node',effectIntent:'mutating'}));
});

test('Build 25 adoption report models workspace/readiness and critical route-policy gap',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-adoption-hardening-'));
  try{
    await writeFile(join(cwd,'package.json'),JSON.stringify({packageManager:'npm@10.9.2',workspaces:['apps/*'],scripts:{test:'node --test'},dependencies:{next:'16.0.0'}}));
    await mkdir(join(cwd,'.github','workflows'),{recursive:true});
    await writeFile(join(cwd,'.github','workflows','ci.yml'),'name: ci\n');
    const ir:ApplicationIR={schemaVersion:'0.1',application:{id:'demo',name:'Demo'},nodes:[{id:'route:/admin',kind:'route',label:'/admin'},{id:'test:admin',kind:'test',label:'admin'}],edges:[],generatedAt:new Date().toISOString()};
    const report=await analyzeAdoption(cwd,ir);
    assert.equal(report.workspace.kind,'npm-workspaces');
    assert.equal(report.workspace.packageManager,'npm@10.9.2');
    assert.ok(report.gaps.some(g=>g.id==='security.routes-without-policy'&&g.severity==='critical'));
    assert.ok(report.readiness.score<75);
  }finally{await rm(cwd,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});

test('Build 25 adoption readiness improves when policies, invariants and tests are modeled',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-adoption-integrated-'));
  try{
    await writeFile(join(cwd,'package.json'),JSON.stringify({scripts:{test:'node --test'},dependencies:{next:'16.0.0'}}));
    await writeFile(join(cwd,'.env.example'),'EXAMPLE=1\n');
    await writeFile(join(cwd,'Dockerfile'),'FROM node:22-bookworm-slim\n');
    await mkdir(join(cwd,'.github','workflows'),{recursive:true});
    await writeFile(join(cwd,'.github','workflows','ci.yml'),'name: ci\n');
    const ir:ApplicationIR={schemaVersion:'0.1',application:{id:'demo',name:'Demo'},nodes:[
      {id:'file:app/page.tsx',kind:'file'},{id:'route:/',kind:'route'},{id:'action:save',kind:'action'},{id:'resource:item',kind:'resource'},{id:'provider:db',kind:'provider'},{id:'test:save',kind:'test'},{id:'policy:save',kind:'policy'},{id:'invariant:tenant',kind:'invariant'}
    ],edges:[],generatedAt:new Date().toISOString()};
    const report=await analyzeAdoption(cwd,ir);
    assert.equal(report.gaps.some(g=>g.severity==='critical'),false);
    assert.equal(report.readiness.status,'integrated');
  }finally{await rm(cwd,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
});

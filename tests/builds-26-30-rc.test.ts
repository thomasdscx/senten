import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { ApplicationIR } from '../packages/core/src/index.js';
import { discoverSourceProject } from '../packages/source-intelligence/src/index.js';
import { nextAdapter } from '../adapters/next/src/index.js';
import { supabaseAdapter } from '../adapters/supabase/src/index.js';
import { computeBlastRadius } from '../packages/impact-intelligence/src/index.js';
import { validateMcpArguments } from '../packages/mcp/src/index.js';
import { analyzeAdoption } from '../packages/adoption/src/index.js';
import { compatibilityReport } from '../packages/stabilization/src/index.js';

const app={id:'demo',name:'Demo'};
const analyzers=[
  ...(nextAdapter.sourceAnalyzers??[]).map(analyzer=>({namespace:'next',analyzer})),
  ...(supabaseAdapter.sourceAnalyzers??[]).map(analyzer=>({namespace:'supabase',analyzer}))
];

async function cleanup(path:string){await rm(path,{recursive:true,force:true,maxRetries:8,retryDelay:75});}

test('Build 26 real-app fixture discovers Next route handlers plus Supabase data/auth semantics',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-rc-next-supabase-'));
  try{
    await writeFile(join(cwd,'package.json'),JSON.stringify({dependencies:{next:'16.0.0',react:'19.0.0','@supabase/supabase-js':'2.57.0'}}));
    await mkdir(join(cwd,'app','api','projects'),{recursive:true});
    await writeFile(join(cwd,'app','api','projects','route.ts'),`import { createClient } from '@supabase/supabase-js';\nconst supabase=createClient('x','y');\nexport async function GET(){ await supabase.auth.getUser(); return supabase.from('projects').select('*'); }\nexport async function POST(){ return supabase.from('projects').insert({name:'x'}); }\n`);
    const result=await discoverSourceProject(cwd,app,undefined,{analyzers});
    assert.ok(result.frameworks.includes('next'));
    assert.ok(result.frameworks.includes('supabase'));
    assert.ok(result.ir.nodes.some(n=>n.id==='route:/api/projects'));
    assert.ok(result.ir.nodes.some(n=>n.id==='action:http/GET:/api/projects'));
    assert.ok(result.ir.nodes.some(n=>n.id==='action:http/POST:/api/projects'));
    assert.ok(result.ir.nodes.some(n=>n.id==='provider:supabase'));
    assert.ok(result.ir.nodes.some(n=>n.id==='resource:projects'));
    assert.ok(result.ir.nodes.some(n=>n.id==='capability:auth'));
    assert.ok(result.ir.edges.some(e=>e.from==='route:/api/projects'&&e.to==='action:http/GET:/api/projects'&&e.relation==='dispatches'));
    assert.ok(result.ir.edges.some(e=>e.to==='resource:projects'&&['reads','writes'].includes(e.relation)));
  }finally{await cleanup(cwd);}
});

test('Build 27 blast-radius intelligence produces bounded explainable risk',()=>{
  const ir:ApplicationIR={schemaVersion:'0.1',application:app,generatedAt:new Date().toISOString(),nodes:[
    {id:'route:/admin',kind:'route'},{id:'action:admin.update',kind:'action'},{id:'policy:admin',kind:'policy'},{id:'resource:accounts',kind:'resource'},{id:'invariant:tenant',kind:'invariant'},{id:'test:admin',kind:'test'}
  ],edges:[
    {from:'route:/admin',to:'action:admin.update',relation:'dispatches'},
    {from:'action:admin.update',to:'policy:admin',relation:'requires'},
    {from:'action:admin.update',to:'resource:accounts',relation:'writes'},
    {from:'action:admin.update',to:'invariant:tenant',relation:'preserves'},
    {from:'test:admin',to:'action:admin.update',relation:'tests'}
  ]};
  const report=computeBlastRadius(ir,'action:admin.update',4);
  assert.equal(report.affected,5);
  assert.ok(['high','critical'].includes(report.risk));
  assert.ok(report.criticalSubjects.includes('policy:admin'));
  assert.ok(report.criticalSubjects.includes('resource:accounts'));
  assert.ok(report.paths.every(p=>p.depth<=4));
});

test('Build 28 MCP adversarial scope blocks traversal and client authority escalation',()=>{
  const cwd=process.cwd();
  assert.equal(validateMcpArguments(cwd,['inspect','file:../../outside.txt']).ok,false);
  assert.equal(validateMcpArguments(cwd,['inspect','../outside.txt']).ok,false);
  assert.equal(validateMcpArguments(cwd,['report','project','--output','../outside.html']).ok,false);
  assert.equal(validateMcpArguments(cwd,['sandbox','run','--allow-live-effects']).ok,false);
  assert.equal(validateMcpArguments(cwd,['doctor','--allow-write']).ok,false);
  assert.equal(validateMcpArguments(cwd,['crawl','https://example.com']).ok,true);
});

test('Build 29 adoption recognizes pnpm monorepos without executing project code',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-rc-pnpm-'));
  try{
    await writeFile(join(cwd,'package.json'),JSON.stringify({packageManager:'pnpm@10.15.0',scripts:{test:'node --test'}}));
    await writeFile(join(cwd,'pnpm-workspace.yaml'),'packages:\n  - apps/*\n  - packages/*\n');
    await writeFile(join(cwd,'Dockerfile'),'FROM node:22-bookworm-slim\n');
    await writeFile(join(cwd,'.env.example'),'EXAMPLE=1\n');
    await mkdir(join(cwd,'.github','workflows'),{recursive:true});
    await writeFile(join(cwd,'.github','workflows','ci.yml'),'name: ci\n');
    const ir:ApplicationIR={schemaVersion:'0.1',application:app,generatedAt:new Date().toISOString(),nodes:[
      {id:'route:/',kind:'route'},{id:'action:save',kind:'action'},{id:'resource:item',kind:'resource'},{id:'provider:db',kind:'provider'},{id:'test:save',kind:'test'},{id:'policy:save',kind:'policy'},{id:'invariant:tenant',kind:'invariant'}
    ],edges:[]};
    const report=await analyzeAdoption(cwd,ir);
    assert.equal(report.workspace.kind,'pnpm-workspace');
    assert.equal(report.workspace.packageManager,'pnpm@10.15.0');
    assert.equal(report.gaps.some(g=>g.severity==='critical'),false);
  }finally{await cleanup(cwd);}
});

test('Build 30 RC compatibility contract exposes frozen candidate protocol identifiers',()=>{
  const ir:ApplicationIR={schemaVersion:'0.1',application:app,nodes:[],edges:[],generatedAt:new Date().toISOString()};
  const report=compatibilityReport(ir,'10');
  assert.equal(report.compatible,true);
  assert.equal(report.contracts.commandSchema,'1.0-rc1');
  assert.equal(report.contracts.extensionProtocol,'1.0-rc1');
  assert.equal(report.contracts.registryProtocol,'1.0-rc1');
});

test('Build 30 root package is release candidate and publishes under rc tag',async()=>{
  const pkg=JSON.parse(await readFile('package.json','utf8')) as {version:string;publishConfig?:{tag?:string}};
  assert.equal(pkg.version,'1.0.0-rc.3');
  assert.equal(pkg.publishConfig?.tag,'rc');
});


test('Build 30 compatibility CLI reports the migration-managed SQLite schema version',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-rc-compat-cli-'));
  const entry=resolve('bin/senten.mjs');
  try{
    let run=spawnSync(process.execPath,[entry,'init'],{cwd,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
    run=spawnSync(process.execPath,[entry,'compatibility','--json'],{cwd,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
    const report=JSON.parse(run.stdout) as {contracts:{stateSchema:string}};
    assert.equal(report.contracts.stateSchema,'10');
  }finally{await cleanup(cwd);}
});

test('Build 30 doctor exposes stale CLI versus Senten repository version mismatch',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-rc-version-align-'));
  const entry=resolve('bin/senten.mjs');
  try{
    await writeFile(join(cwd,'package.json'),JSON.stringify({name:'senten',version:'9.9.9'}));
    let run=spawnSync(process.execPath,[entry,'init'],{cwd,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
    run=spawnSync(process.execPath,[entry,'doctor','--json'],{cwd,encoding:'utf8'});
    const report=JSON.parse(run.stdout) as {version:string;checks:Array<{name:string;ok:boolean;detail:string}>};
    const alignment=report.checks.find(c=>c.name==='CLI/source version alignment');
    assert.equal(report.version,'1.0.0-rc.3');
    assert.equal(alignment?.ok,false);
    assert.match(alignment?.detail??'',/running 1\.0\.0-rc\.3; repository package\.json is 9\.9\.9/);
  }finally{await cleanup(cwd);}
});

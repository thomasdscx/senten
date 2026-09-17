import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeAdoption } from '../packages/adoption/src/index.js';
import { CapabilityRegistry, CapabilityRuntime, evaluateBudget } from '../packages/capabilities/src/index.js';
import { compatibilityReport } from '../packages/stabilization/src/index.js';
import { gitIntegration } from '../integrations/git/src/index.js';
import type { ApplicationIR } from '../packages/core/src/index.js';

const ir:ApplicationIR={schemaVersion:'0.1',application:{id:'demo',name:'Demo'},generatedAt:new Date(0).toISOString(),nodes:[
  {id:'application:demo',kind:'application',label:'Demo'},
  {id:'route:/api/projects',kind:'route',label:'/api/projects'},
  {id:'action:project.create',kind:'action',label:'project.create'},
  {id:'resource:project',kind:'resource',label:'project'},
  {id:'test:projects',kind:'test',label:'projects'}
],edges:[]};

test('Build 13 adoption detects architecture without executing project code',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-adopt-'));
  try{
    await writeFile(join(cwd,'package.json'),JSON.stringify({dependencies:{next:'16.0.0','@supabase/supabase-js':'2.0.0'},scripts:{test:'node --test'}}));
    await writeFile(join(cwd,'.env.example'),'PUBLIC_URL=http://example.invalid\n');
    await mkdir(join(cwd,'.github','workflows'),{recursive:true}); await writeFile(join(cwd,'.github','workflows','ci.yml'),'name: CI\n');
    const report=await analyzeAdoption(cwd,ir);
    assert.ok(report.signals.some(x=>x.label==='Next.js'));
    assert.ok(report.signals.some(x=>x.label==='Supabase'));
    assert.equal(report.summary.routes,1);
    assert.ok(report.coverage.semantic>0);
  }finally{await rm(cwd,{recursive:true,force:true});}
});

test('Build 15 capability runtime selects highest healthy provider and enforces budgets',async()=>{
  const registry=new CapabilityRegistry()
    .register({id:'degraded',capability:'ai',priority:100,health:()=> 'degraded'})
    .register({id:'healthy',capability:'ai',priority:50,health:()=> 'healthy'});
  const selected=await registry.select('ai');
  assert.equal(selected.provider?.id,'healthy');
  const budget=evaluateBudget({maxLatencyMs:500,maxTokens:1000},{latencyMs:700,tokens:900});
  assert.equal(budget.ok,false); assert.match(budget.violations.join(' '),/latency/);
});

test('Build 15 capability runtime executes a healthy provider and fails closed on degraded-only providers',async()=>{
  const healthy=new CapabilityRegistry().register({id:'local-db',capability:'database',execute:async(input)=>({echo:input})});
  const runtime=new CapabilityRuntime(healthy,{database:{maxCalls:1,maxLatencyMs:5000}});
  const result=await runtime.execute<Record<string,string>,{echo:Record<string,string>}>('database',{q:'select'});
  assert.equal(result.providerId,'local-db'); assert.deepEqual(result.value,{echo:{q:'select'}});
  const degraded=new CapabilityRegistry().register({id:'backup',capability:'email',health:()=> 'degraded',execute:async()=>true});
  await assert.rejects(()=>new CapabilityRuntime(degraded).execute('email',{}),/fail-closed/);
});

test('Build 16 Git integration exposes persistent context commands without credential capability',()=>{
  const paths=gitIntegration.commands?.map(c=>c.path)??[];
  assert.ok(paths.includes('bind')); assert.ok(paths.includes('context')); assert.ok(paths.includes('doctor'));
  assert.ok(!gitIntegration.capabilities.some(x=>/token|credential\.write|secret/.test(x)));
});

test('Build 20 compatibility boundary recognizes current Application IR',()=>{
  const report=compatibilityReport(ir,'10');
  assert.equal(report.compatible,true);
  assert.equal(report.irSchema,'0.1');
  assert.equal(report.contracts.extensionProtocol,'1.0-rc1');
});

test('Build 12 npm workflow uses OIDC trusted-publishing shape and no long-lived NPM token',async()=>{
  const workflow=await readFile('.github/workflows/publish-npm.yml','utf8');
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/npm publish --provenance/);
  assert.doesNotMatch(workflow,/NPM_TOKEN/);
});

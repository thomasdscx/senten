import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverSourceProject } from '../packages/source-intelligence/src/index.js';
import { listScenarios, runScenario, exportScenarioArtifacts } from '../packages/scenario-lab/src/index.js';
import type { ApplicationIR } from '../packages/core/src/index.js';

const app={id:'fixture',name:'Fixture'};
const base:ApplicationIR={schemaVersion:'0.1',application:app,nodes:[],edges:[],generatedAt:new Date(0).toISOString()};

test('architecture manifest contributes declared invariants and policies without executing project code',async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-architecture-manifest-'));
  try{
    await writeFile(join(root,'package.json'),JSON.stringify({name:'fixture'}));
    await writeFile(join(root,'index.ts'),'export function run(){ return true }');
    await writeFile(join(root,'senten.architecture.json'),JSON.stringify({schemaVersion:'0.1',nodes:[{id:'policy:fixture.read',kind:'policy'},{id:'invariant:fixture.boundary',kind:'invariant'}],edges:[{from:'invariant:fixture.boundary',to:'policy:fixture.read',relation:'enforced-by'}]}));
    const result=await discoverSourceProject(root,app,base,{force:true});
    assert.ok(result.ir.nodes.some(n=>n.id==='policy:fixture.read'&&n.metadata?.declaredBy==='architecture-manifest'));
    assert.ok(result.ir.nodes.some(n=>n.id==='invariant:fixture.boundary'));
    assert.ok(result.ir.edges.some(e=>e.from==='invariant:fixture.boundary'&&e.to==='policy:fixture.read'));
  }finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:25});}
});

test('scenario lab verifies all controlled dogfood fixtures',async()=>{
  const root=process.cwd();const scenarios=await listScenarios(root);assert.ok(scenarios.length>=6);
  for(const scenario of scenarios){const result=await runScenario(root,scenario.id);assert.equal(result.passed,true,`${scenario.id}: ${result.failures.join('; ')}`);}
});

test('showcase export produces real scenario artifacts and an index',async()=>{
  const out=await mkdtemp(join(tmpdir(),'senten-showcase-'));
  try{const result=await exportScenarioArtifacts(process.cwd(),out);assert.equal(result.failed,0);assert.ok(result.count>=6);const index=JSON.parse(await readFile(join(out,'index.json'),'utf8')) as {scenarios:unknown[]};assert.equal(index.scenarios.length,result.count);}finally{await rm(out,{recursive:true,force:true,maxRetries:5,retryDelay:25});}
});

test('Senten self model declares security and evidence invariants',async()=>{
  const manifest=JSON.parse(await readFile(join(process.cwd(),'senten.architecture.json'),'utf8')) as {nodes:{id:string}[]};
  const ids=new Set(manifest.nodes.map(n=>n.id));
  for(const id of ['invariant:mcp.live-effects-require-explicit-gate','invariant:evidence.verified-cannot-be-self-issued','invariant:adapter.merge-is-deterministic','invariant:registry.remote-install-fails-closed'])assert.ok(ids.has(id),id);
});

test('.sentenignore prevents controlled fixtures from polluting application discovery',async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-ignore-'));
  try{
    await mkdir(join(root,'src'),{recursive:true});await mkdir(join(root,'examples','scenarios','demo'),{recursive:true});
    await writeFile(join(root,'package.json'),JSON.stringify({name:'fixture'}));
    await writeFile(join(root,'.sentenignore'),'examples/scenarios/\n');
    await writeFile(join(root,'src','index.ts'),'export function main(){return true}');
    await writeFile(join(root,'examples','scenarios','demo','route.ts'),'export async function DELETE(){return true}');
    const result=await discoverSourceProject(root,app,base,{force:true});
    assert.ok(result.ir.nodes.some(n=>n.id==='file:src/index.ts'));
    assert.ok(!result.ir.nodes.some(n=>String(n.source??'').includes('examples/scenarios')));
  }finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:25});}
});

test('dynamic test evidence requires explicit execution authority and records deterministic status',async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-test-evidence-'));
  try{
    const { spawnSync }=await import('node:child_process');const entry=join(process.cwd(),'bin','senten.mjs');
    let r=spawnSync(process.execPath,[entry,'init'],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
    r=spawnSync(process.execPath,[entry,'declare','invariant','fixture.test'],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
    r=spawnSync(process.execPath,[entry,'evidence','test','invariant:fixture.test','--',process.execPath,'-e','process.exit(0)'],{cwd:root,encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/--allow-exec/);
    r=spawnSync(process.execPath,[entry,'evidence','test','invariant:fixture.test','--allow-exec','--',process.execPath,'-e','process.exit(0)'],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/Status   tested/);
  }finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:25});}
});

test('RC3 adapter analyzers ignore detector strings inside Senten implementation and test fixtures',async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-framework-self-pollution-'));
  try{
    await mkdir(join(root,'src'),{recursive:true});
    await writeFile(join(root,'package.json'),JSON.stringify({name:'senten-like'}));
    await writeFile(join(root,'src','detectors.ts'),`\n      export const examples = [\n        "import Link from 'next/link'",\n        '@supabase/supabase-js',\n        'expo-router',\n        '@tauri-apps/api/core'\n      ];\n      export function detectorSource(){ return /invoke\\s*\\(/.test('fixture'); }\n    `);
    const { nextAdapter }=await import('../adapters/next/src/index.js');
    const { expoAdapter }=await import('../adapters/expo/src/index.js');
    const { tauriAdapter }=await import('../adapters/tauri/src/index.js');
    const { supabaseAdapter }=await import('../adapters/supabase/src/index.js');
    const analyzers=[nextAdapter,expoAdapter,tauriAdapter,supabaseAdapter].flatMap(adapter=>(adapter.sourceAnalyzers??[]).map(analyzer=>({namespace:adapter.namespace,analyzer})));
    const result=await discoverSourceProject(root,app,base,{force:true,analyzers});
    assert.deepEqual(result.frameworks,[]);
    assert.ok(!result.ir.nodes.some(n=>['next','expo','tauri','supabase'].includes(String(n.metadata?.framework??n.metadata?.provider??''))));
  }finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:25});}
});

test('RC3 library adoption does not recommend web route adapters without a route-bearing framework',async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-cli-adoption-'));
  try{
    await writeFile(join(root,'package.json'),JSON.stringify({name:'cli-tool',scripts:{test:'node --test'}}));
    await writeFile(join(root,'index.ts'),'export function run(){return true}');
    const result=await discoverSourceProject(root,app,base,{force:true});
    const { analyzeAdoption }=await import('../packages/adoption/src/index.js');
    const report=await analyzeAdoption(root,result.ir);
    assert.ok(!report.recommendations.some(x=>x.includes('externally reachable routes')));
  }finally{await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:25});}
});

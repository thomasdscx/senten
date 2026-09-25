import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverSourceProject } from '../packages/source-intelligence/src/index.js';
import { analyzeAdoption } from '../packages/adoption/src/index.js';
import { nextAdapter } from '../adapters/next/src/index.js';
import { drizzleAdapter } from '../adapters/drizzle/src/index.js';
import { mergeApplicationIRFragments } from '../packages/semantic/src/index.js';
import type { ApplicationIR } from '../packages/core/src/index.js';

const app={id:'dogfood',name:'Dogfood'};
const analyzers=[
  ...(nextAdapter.sourceAnalyzers??[]).map(analyzer=>({namespace:'next',analyzer})),
  ...(drizzleAdapter.sourceAnalyzers??[]).map(analyzer=>({namespace:'drizzle',analyzer}))
];
async function cleanup(path:string){await rm(path,{recursive:true,force:true,maxRetries:8,retryDelay:75});}

async function makeNextAuthDrizzleFixture(){
  const cwd=await mkdtemp(join(tmpdir(),'senten-rc4-dogfood-'));
  await writeFile(join(cwd,'package.json'),JSON.stringify({name:'fixture',dependencies:{next:'15.0.0',react:'19.0.0','next-auth':'5.0.0','drizzle-orm':'0.40.0',postgres:'3.4.0'}}));
  await mkdir(join(cwd,'app','api','auth','[...nextauth]'),{recursive:true});
  await mkdir(join(cwd,'app','protected'),{recursive:true});
  await writeFile(join(cwd,'app','api','auth','[...nextauth]','route.ts'),`import NextAuth from 'next-auth';\nexport const { GET, POST } = NextAuth({ providers: [] });\n`);
  await writeFile(join(cwd,'app','auth.ts'),`import { db } from 'app/db';\nexport async function login(){ return db; }\n`);
  await writeFile(join(cwd,'app','db.ts'),`import { drizzle } from 'drizzle-orm/postgres-js';\nimport { pgTable, serial, text } from 'drizzle-orm/pg-core';\nimport postgres from 'postgres';\nexport const users = pgTable('User', { id: serial('id').primaryKey(), email: text('email') });\nconst client=postgres('x');\nexport const db=drizzle(client);\nexport async function createUser(){ return db.insert(users).values({email:'x'}); }\nexport async function getUser(){ return db.select().from(users); }\n`);
  await writeFile(join(cwd,'app','protected','page.tsx'),`import { login } from 'app/auth';\nexport default async function Protected(){ await login(); return <main>Protected</main>; }\n`);
  await writeFile(join(cwd,'middleware.ts'),`import NextAuth from 'next-auth';\nexport const { auth } = NextAuth({ providers: [] });\nexport const config={matcher:['/protected/:path*']};\n`);
  return cwd;
}

test('RC4 canonicalizes Next catch-all routes and prevents duplicate adapter edges across rediscovery',async()=>{
  const cwd=await makeNextAuthDrizzleFixture();
  try{
    const first=await discoverSourceProject(cwd,app,undefined,{force:true,analyzers});
    const second=await discoverSourceProject(cwd,app,first.ir,{force:true,analyzers});
    const routes=second.ir.nodes.filter(n=>n.kind==='route'&&n.source==='app/api/auth/[...nextauth]/route.ts');
    assert.equal(routes.length,1);
    assert.equal(routes[0]?.id,'route:/api/auth/:nextauth*');
    const edges=second.ir.edges.filter(e=>e.from==='file:app/api/auth/[...nextauth]/route.ts'&&e.to==='route:/api/auth/:nextauth*'&&e.relation==='implements-route');
    assert.equal(edges.length,1);
    const provenance=(edges[0]?.metadata?.irFragmentProvenance as unknown[]|undefined)??[];
    assert.equal(provenance.length,1);
  }finally{await cleanup(cwd);}
});

test('RC4 resolves project-root imports before classifying external package providers',async()=>{
  const cwd=await makeNextAuthDrizzleFixture();
  try{
    const result=await discoverSourceProject(cwd,app,undefined,{force:true,analyzers});
    assert.ok(!result.ir.nodes.some(n=>n.id==='provider:package/app'));
    assert.ok(result.ir.edges.some(e=>e.from==='file:app/auth.ts'&&e.to==='file:app/db.ts'&&e.relation==='imports'));
  }finally{await cleanup(cwd);}
});

test('RC4 Drizzle adapter extracts resources and action read/write relationships',async()=>{
  const cwd=await makeNextAuthDrizzleFixture();
  try{
    const result=await discoverSourceProject(cwd,app,undefined,{force:true,analyzers});
    assert.ok(result.ir.nodes.some(n=>n.id==='provider:drizzle'));
    assert.ok(result.ir.nodes.some(n=>n.id==='resource:User'));
    assert.ok(result.ir.edges.some(e=>e.from==='action:createUser@app/db.ts'&&e.to==='resource:User'&&e.relation==='writes'));
    assert.ok(result.ir.edges.some(e=>e.from==='action:getUser@app/db.ts'&&e.to==='resource:User'&&e.relation==='reads'));
  }finally{await cleanup(cwd);}
});

test('RC4 adoption distinguishes detected auth from explicit Senten policy coverage',async()=>{
  const cwd=await makeNextAuthDrizzleFixture();
  try{
    const result=await discoverSourceProject(cwd,app,undefined,{force:true,analyzers});
    const report=await analyzeAdoption(cwd,result.ir);
    assert.equal(report.security.state,'detected-but-unmapped');
    assert.ok(report.security.authMechanisms.includes('Auth.js'));
    assert.equal(report.gaps.some(g=>g.id==='security.auth-unmapped'&&g.severity==='warning'),true);
    assert.equal(report.gaps.some(g=>g.category==='security'&&g.severity==='critical'),false);
    assert.ok(report.summary.resources>0);
    assert.ok(report.coverage.semanticBreakdown.some(d=>d.id==='resources'&&d.score===100));
  }finally{await cleanup(cwd);}
});

test('RC4 semantic merge deduplicates identical provenance records',()=>{
  const base:ApplicationIR={schemaVersion:'0.1',application:app,nodes:[{id:'file:a.ts',kind:'file'}],edges:[],generatedAt:new Date().toISOString()};
  const fragment={schemaVersion:'0.1' as const,nodes:[{id:'route:/',kind:'route' as const}],edges:[{from:'file:a.ts',to:'route:/',relation:'implements-route'}],source:{adapter:'next',adapterVersion:'1.0.0-rc.5',analyzer:'next.source',confidence:'high' as const,files:['a.ts']}};
  const once=mergeApplicationIRFragments(base,[fragment]).ir;
  const twice=mergeApplicationIRFragments(once,[fragment]).ir;
  const edge=twice.edges.find(e=>e.relation==='implements-route');
  assert.equal(((edge?.metadata?.irFragmentProvenance as unknown[])??[]).length,1);
});

test('RC4 record captures dogfood commands and exports a human-readable Markdown report',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-rc4-record-'));
  try{
    const { spawnSync }=await import('node:child_process');
    const { resolve }=await import('node:path');
    const { readdir, readFile }=await import('node:fs/promises');
    const entry=resolve('bin/senten.mjs');
    const run=(args:string[])=>spawnSync(process.execPath,[entry,...args],{cwd,encoding:'utf8'});
    let r=run(['init']);assert.equal(r.status,0,r.stderr);
    await writeFile(join(cwd,'index.ts'),'export function run(){return true}');
    r=run(['record','start','external-dogfood']);assert.equal(r.status,0,r.stderr);
    r=run(['discover']);assert.equal(r.status,0,r.stderr);
    r=run(['adopt']);assert.equal(r.status,0,r.stderr);
    r=run(['compatibility']);assert.equal(r.status,0,r.stderr);
    r=run(['record','stop']);assert.equal(r.status,0,r.stderr);
    r=run(['record','export','--format','md']);assert.equal(r.status,0,r.stderr);
    const files=await readdir(join(cwd,'.senten','records'));const md=files.find(f=>f.endsWith('.md'));assert.ok(md);
    const report=await readFile(join(cwd,'.senten','records',md!),'utf8');
    assert.match(report,/Senten Record/);assert.match(report,/senten discover/);assert.match(report,/senten adopt/);assert.match(report,/Adoption Snapshot/);assert.match(report,/\*\*PASS\*\*/);
  }finally{await cleanup(cwd);}
});

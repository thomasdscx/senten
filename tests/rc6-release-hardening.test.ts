import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { discoverSourceProject } from '../packages/source-intelligence/src/index.js';
import { analyzeAdoption } from '../packages/adoption/src/index.js';
import { nextAdapter } from '../adapters/next/src/index.js';
import { expoAdapter } from '../adapters/expo/src/index.js';

const app={id:'fixture',name:'Fixture'};
const analyzers=[
  ...(nextAdapter.sourceAnalyzers??[]).map(analyzer=>({namespace:'next',analyzer})),
  ...(expoAdapter.sourceAnalyzers??[]).map(analyzer=>({namespace:'expo',analyzer}))
];
async function cleanup(path:string){await rm(path,{recursive:true,force:true,maxRetries:8,retryDelay:75});}

async function makeMonorepoFixture(){
  const cwd=await mkdtemp(join(tmpdir(),'senten-rc6-mono-'));
  await writeFile(join(cwd,'package.json'),JSON.stringify({name:'basic',private:true,packageManager:'pnpm@11.25.0'}));
  await writeFile(join(cwd,'pnpm-workspace.yaml'),"packages:\n  - 'apps/*'\n  - 'packages/*'\n");
  for(const name of ['docs','web']){
    const root=join(cwd,'apps',name);await mkdir(join(root,'app'),{recursive:true});
    await writeFile(join(root,'package.json'),JSON.stringify({name:`@repo/${name}`,dependencies:{next:'15.0.0',react:'19.0.0','@repo/ui':'workspace:*'}}));
    await writeFile(join(root,'app','page.tsx'),`import Link from 'next/link'; import { Button } from '@repo/ui'; export default function Home(){return <Button>${name}</Button>}`);
  }
  await mkdir(join(cwd,'packages','ui','src'),{recursive:true});
  await writeFile(join(cwd,'packages','ui','package.json'),JSON.stringify({name:'@repo/ui',dependencies:{react:'19.0.0'}}));
  await writeFile(join(cwd,'packages','ui','src','button.tsx'),`import React from 'react'; export function Button({children}:{children:React.ReactNode}){return <button>{children}</button>}`);
  return cwd;
}

test('RC6 scopes duplicate monorepo routes by workspace package',async()=>{
  const cwd=await makeMonorepoFixture();
  try{
    const result=await discoverSourceProject(cwd,app,undefined,{force:true,analyzers});
    const routes=result.ir.nodes.filter(n=>n.kind==='route');
    assert.equal(routes.length,2);
    assert.ok(routes.some(n=>n.id==='route:apps/docs:/'));
    assert.ok(routes.some(n=>n.id==='route:apps/web:/'));
    assert.ok(result.ir.edges.some(e=>e.from==='file:apps/docs/app/page.tsx'&&e.to==='route:apps/docs:/'&&e.relation==='implements-route'));
    assert.ok(result.ir.edges.some(e=>e.from==='file:apps/web/app/page.tsx'&&e.to==='route:apps/web:/'&&e.relation==='implements-route'));
  }finally{await cleanup(cwd);}
});

test('RC6 models local workspace imports as modules instead of external providers',async()=>{
  const cwd=await makeMonorepoFixture();
  try{
    const result=await discoverSourceProject(cwd,app,undefined,{force:true,analyzers});
    assert.ok(result.ir.nodes.some(n=>n.id==='module:@repo/ui'));
    assert.ok(!result.ir.nodes.some(n=>n.id==='provider:package/@repo/ui'));
    assert.ok(result.ir.edges.some(e=>e.from==='file:apps/docs/app/page.tsx'&&e.to==='module:@repo/ui'&&e.relation==='uses-workspace-package'));
  }finally{await cleanup(cwd);}
});

test('RC6 adoption surfaces framework and workspace signals while avoiding generic auth warnings for ordinary routes',async()=>{
  const cwd=await makeMonorepoFixture();
  try{
    const result=await discoverSourceProject(cwd,app,undefined,{force:true,analyzers});
    const report=await analyzeAdoption(cwd,result.ir);
    assert.equal(report.workspace.kind,'pnpm-workspace');
    assert.ok((report.workspace.packages??0)>=3);
    assert.ok(report.signals.some(s=>s.category==='framework'&&s.label==='Next.js'));
    assert.ok(report.signals.some(s=>s.category==='workspace'));
    assert.equal(report.gaps.some(g=>g.id==='security.security-unmapped'&&g.severity==='warning'),false);
  }finally{await cleanup(cwd);}
});

test('RC6 init is idempotent and --init can bootstrap a state-dependent command',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-rc6-init-'));
  try{
    const entry=resolve('bin/senten.mjs');
    const run=(args:string[])=>spawnSync(process.execPath,[entry,...args],{cwd,encoding:'utf8'});
    let r=run(['init']);assert.equal(r.status,0,r.stderr);
    r=run(['init']);assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/already initialized/i);
    const cwd2=await mkdtemp(join(tmpdir(),'senten-rc6-autoinit-'));
    try{
      await writeFile(join(cwd2,'index.ts'),'export const value=1;');
      const rr=spawnSync(process.execPath,[entry,'record','start','smoke','--init'],{cwd:cwd2,encoding:'utf8'});
      assert.equal(rr.status,0,rr.stderr);assert.match(rr.stdout,/RECORDING STARTED/);
      const cfg=JSON.parse(await readFile(join(cwd2,'senten.config.json'),'utf8'));
      assert.ok(cfg.application?.id);
    }finally{await cleanup(cwd2);}
  }finally{await cleanup(cwd);}
});

test('RC6 template generator framework detection reports platform rather than template choices',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-rc6-generator-'));
  try{
    await writeFile(join(cwd,'package.json'),JSON.stringify({name:'create-tauri-app',devDependencies:{react:'19.0.0',vue:'3.0.0','@angular/core':'20.0.0'}}));
    await mkdir(join(cwd,'templates','react'),{recursive:true});
    await writeFile(join(cwd,'index.ts'),`export const templates=['react','vue','angular'];`);
    const result=await discoverSourceProject(cwd,app,undefined,{force:true,analyzers});
    assert.deepEqual(result.frameworks,['tauri']);
  }finally{await cleanup(cwd);}
});

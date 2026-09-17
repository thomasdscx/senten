import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { defineApplicationIRFragment, validateApplicationIRFragment } from '../packages/extension-sdk/src/index.js';
import { mergeApplicationIRFragments } from '../packages/semantic/src/index.js';
import { assertSandboxEffectBoundary } from '../packages/sandbox/src/index.js';
import { buildMcpToolDefinitions, mcpEnvironment } from '../packages/mcp/src/index.js';
import { discoverSourceProject } from '../packages/source-intelligence/src/index.js';
import { nextAdapter } from '../adapters/next/src/index.js';
import { expoAdapter } from '../adapters/expo/src/index.js';
import { tauriAdapter } from '../adapters/tauri/src/index.js';
import type { ApplicationIR, SandboxRecord } from '../packages/core/src/index.js';



async function removeTempDirectory(path:string):Promise<void>{
  await rm(path,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}

async function stopChild(child:ChildProcess):Promise<void>{
  if(child.exitCode!==null || child.signalCode!==null) return;
  const closed=once(child,'close').then(()=>undefined);
  child.stdin?.end();
  child.kill();
  const exited=await Promise.race([
    closed.then(()=>true),
    new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),2000))
  ]);
  if(exited) return;
  if(process.platform==='win32' && child.pid){
    spawnSync('taskkill',['/pid',String(child.pid),'/T','/F'],{stdio:'ignore'});
  }else{
    child.kill('SIGKILL');
  }
  if(child.exitCode===null && child.signalCode===null){
    await Promise.race([closed,new Promise<void>(resolve=>setTimeout(resolve,2000))]);
  }
}

const base:ApplicationIR={schemaVersion:'0.1',application:{id:'demo',name:'Demo'},nodes:[{id:'application:demo',kind:'application',label:'Demo'},{id:'file:src/a.ts',kind:'file',label:'a'}],edges:[],generatedAt:new Date(0).toISOString()};

test('Build 21 IR fragment SPI validates and deterministically merges provenance',()=>{
  const fragment=defineApplicationIRFragment({schemaVersion:'0.1',applicationId:'demo',nodes:[{id:'action:save',kind:'action',label:'save'}],edges:[{from:'file:src/a.ts',to:'action:save',relation:'implements'}],source:{adapter:'demo-adapter',adapterVersion:'1.0.0',files:['src/a.ts'],confidence:'high'}});
  assert.equal(validateApplicationIRFragment(fragment,base.application).ok,true);
  const merged=mergeApplicationIRFragments(base,[fragment]);
  assert.equal(merged.ir.nodes.some(n=>n.id==='action:save'),true);
  assert.equal(merged.ir.edges.some(e=>e.to==='action:save'),true);
  const node=merged.ir.nodes.find(n=>n.id==='action:save');
  assert.equal((node?.metadata?.irFragmentProvenance as Array<{adapter:string}>)[0]?.adapter,'demo-adapter');
});

test('Build 21 IR merger rejects kind collisions rather than silently corrupting identity',()=>{
  const fragment=defineApplicationIRFragment({schemaVersion:'0.1',nodes:[{id:'file:src/a.ts',kind:'action'}],edges:[],source:{adapter:'bad',adapterVersion:'1.0.0'}});
  const merged=mergeApplicationIRFragments(base,[fragment]);
  assert.ok(merged.diagnostics.some(d=>d.code==='fragment.identity-collision'));
  assert.equal(merged.ir.nodes.find(n=>n.id==='file:src/a.ts')?.kind,'file');
});

test('Build 21 first-party Next/Expo/Tauri adapters expose IR-fragment analyzers',()=>{
  for(const adapter of [nextAdapter,expoAdapter,tauriAdapter]){
    assert.ok(adapter.sourceAnalyzers?.length);
    assert.ok(adapter.capabilities.includes('semantic.write'));
  }
});

test('Build 21 source discovery consumes adapter IR fragments incrementally',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-ir-spi-'));
  try{
    await mkdir(join(cwd,'app','projects'),{recursive:true});
    await writeFile(join(cwd,'app','projects','page.tsx'),"import Link from 'next/link'; export default function Page(){return <Link href='/'>Home</Link>}\n");
    const registration={namespace:'next',analyzer:nextAdapter.sourceAnalyzers![0]!};
    const result=await discoverSourceProject(cwd,{id:'demo',name:'Demo'},undefined,{analyzers:[registration]});
    assert.ok(result.ir.nodes.some(n=>n.id==='route:/projects'));
    const route=result.ir.nodes.find(n=>n.id==='route:/projects');
    assert.ok(Array.isArray(route?.metadata?.irFragmentProvenance));
  }finally{await removeTempDirectory(cwd);}
});


test('Build 21 IR fragment validation rejects malformed adapter provenance',()=>{
  const check=validateApplicationIRFragment({schemaVersion:'0.1',nodes:[],edges:[],source:{adapter:'Bad Adapter',adapterVersion:'not-semver'}});
  assert.equal(check.ok,false);
  assert.match(check.errors.join(' '),/lowercase identifier/);
  assert.match(check.errors.join(' '),/semver/);
});

test('Build 21 MCP child environment excludes arbitrary secrets',()=>{
  const env=mcpEnvironment({PATH:'/bin',HOME:'/tmp/home',SUPER_SECRET_TOKEN:'do-not-forward'});
  assert.equal(env.PATH,'/bin');
  assert.equal(env.HOME,'/tmp/home');
  assert.equal(env.SUPER_SECRET_TOKEN,undefined);
  assert.equal(env.SENTEN_MCP,'1');
});

test('Build 21 mutating sandbox actions fail closed without enforceable boundary',()=>{
  const local:SandboxRecord={id:'s',provider:'local',isolation:'workspace-copy',root:'/tmp/s',projectRoot:'/tmp',environmentName:'sandbox',network:'inherit',status:'active',createdAt:new Date().toISOString()};
  assert.throws(()=>assertSandboxEffectBoundary(local,{command:'node',effectIntent:'mutating'}),/enforceable effect boundary/i);
  assert.equal(assertSandboxEffectBoundary(local,{command:'node',effectIntent:'mutating',allowLiveEffects:true}).mode,'live-effects');
});

test('Build 21 Docker network-deny is accepted as contained mutation boundary',()=>{
  const docker:SandboxRecord={id:'s',provider:'docker',isolation:'container',root:'/tmp/s',projectRoot:'/tmp',environmentName:'sandbox',network:'deny',status:'active',createdAt:new Date().toISOString(),containerId:'senten-s'};
  const boundary=assertSandboxEffectBoundary(docker,{command:'node',effectIntent:'mutating'});
  assert.equal(boundary.mode,'contained-mutation');
});

test('Build 21 MCP tool schema is read-only aware and machine discoverable',()=>{
  const tools=buildMcpToolDefinitions([{name:'impact',capability:'project.read',mutating:false},{name:'declare',capability:'semantic.write',mutating:true}]);
  assert.equal(tools[0]?.name,'senten_impact');
  assert.equal(tools[0]?.mutating,false);
  assert.equal(tools[1]?.mutating,true);
});

test('Build 21 MCP stdio transport initializes and hides mutating tools by default',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-mcp-'));
  try{
    const cli=join(process.cwd(),'bin','senten.mjs');
    const child=spawn(process.execPath,[cli,'mcp','serve'],{cwd,stdio:['pipe','pipe','pipe']});
    let output='';child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>output+=chunk);
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})+'\n');
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})+'\n');
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('MCP transport timeout')),5000);const check=()=>{const lines=output.trim().split(/\r?\n/).filter(Boolean);if(lines.length>=2){clearTimeout(timer);resolve();}else setTimeout(check,20)};check();});
    await stopChild(child);
    const messages=output.trim().split(/\r?\n/).map(line=>JSON.parse(line) as {id:number;result?:{tools?:Array<{name:string}>}});
    assert.equal(messages[0]?.id,1);
    const names=messages.find(m=>m.id===2)?.result?.tools?.map(t=>t.name)??[];
    assert.ok(names.includes('senten_impact'));
    assert.ok(!names.includes('senten_declare'));
  }finally{await removeTempDirectory(cwd);}
});

test('Build 21 MCP stdio executes read-only tools through the real CLI entrypoint',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-mcp-call-'));
  try{
    const cli=join(process.cwd(),'bin','senten.mjs');
    const initialized=spawnSync(process.execPath,[cli,'init'],{cwd,encoding:'utf8'});assert.equal(initialized.status,0,initialized.stderr);
    const child=spawn(process.execPath,[cli,'mcp','serve'],{cwd,stdio:['pipe','pipe','pipe']});
    let output='';child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>output+=chunk);
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}})+'\n');
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'senten_doctor',arguments:{args:[]}}})+'\n');
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('MCP tool call timeout')),5000);const check=()=>{const lines=output.trim().split(/\r?\n/).filter(Boolean);if(lines.length>=2){clearTimeout(timer);resolve();}else setTimeout(check,20)};check();});
    await stopChild(child);
    const messages=output.trim().split(/\r?\n/).map(line=>JSON.parse(line) as {id:number;result?:{content?:Array<{text:string}>;isError?:boolean}});
    const call=messages.find(m=>m.id===2)?.result;
    assert.equal(call?.isError,false);
    assert.match(call?.content?.[0]?.text??'',/SENTEN DOCTOR/);
  }finally{await removeTempDirectory(cwd);}
});

test('Build 21 MCP requires a second explicit gate for live effects',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-mcp-live-'));
  try{
    const cli=join(process.cwd(),'bin','senten.mjs');
    const child=spawn(process.execPath,[cli,'mcp','serve','--allow-write'],{cwd,stdio:['pipe','pipe','pipe']});
    let output='';child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>output+=chunk);
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})+'\n');
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'senten_clickthru',arguments:{args:['http://127.0.0.1:9','--include-actions','--allow-live-effects']}}})+'\n');
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('MCP live-effect gate timeout')),5000);const check=()=>{const lines=output.trim().split(/\r?\n/).filter(Boolean);if(lines.length>=2){clearTimeout(timer);resolve();}else setTimeout(check,20)};check();});
    await stopChild(child);
    const messages=output.trim().split(/\r?\n/).map(line=>JSON.parse(line) as {id:number;result?:{content?:Array<{text:string}>;isError?:boolean}});
    const call=messages.find(m=>m.id===2)?.result;
    assert.equal(call?.isError,true);
    assert.match(call?.content?.[0]?.text??'',/Live external effects are disabled/);
  }finally{await removeTempDirectory(cwd);}
});

test('Build 21 framework adapters avoid cross-framework app-directory false positives',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-framework-discrim-'));
  try{
    await mkdir(join(cwd,'app','settings'),{recursive:true});
    await writeFile(join(cwd,'package.json'),JSON.stringify({dependencies:{next:'16.0.0',react:'19.0.0'}}));
    await writeFile(join(cwd,'app','settings','page.tsx'),"export default function Page(){return <main>Settings</main>}\n");
    const analyzers=[
      {namespace:'next',analyzer:nextAdapter.sourceAnalyzers![0]!},
      {namespace:'expo',analyzer:expoAdapter.sourceAnalyzers![0]!},
      {namespace:'tauri',analyzer:tauriAdapter.sourceAnalyzers![0]!}
    ];
    const result=await discoverSourceProject(cwd,{id:'demo',name:'Demo'},undefined,{analyzers});
    const route=result.ir.nodes.find(n=>n.id==='route:/settings');
    assert.ok(route);
    const provenance=(route?.metadata?.irFragmentProvenance as Array<{adapter:string}>|undefined)??[];
    assert.ok(provenance.some(p=>p.adapter==='next'));
    assert.ok(!provenance.some(p=>p.adapter==='expo'));
    assert.ok(!provenance.some(p=>p.adapter==='tauri'));
    assert.ok(result.frameworks.includes('next'));
    assert.ok(!result.frameworks.includes('expo'));
  }finally{await removeTempDirectory(cwd);}
});

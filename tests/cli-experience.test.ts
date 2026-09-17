import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = resolve(process.cwd(), 'bin', 'senten.mjs');
function run(cwd:string,args:string[]){
  return spawnSync(process.execPath,[cli,...args],{cwd,encoding:'utf8'});
}

test('doctor gives first-run guidance for an uninitialized directory', async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-doctor-'));
  try{
    const result=run(root,['doctor']);
    assert.notEqual(result.status,0);
    assert.match(result.stdout,/has not been initialized/i);
    assert.match(result.stdout,/senten init/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('workflow builder can create, add, inspect and validate steps', async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-workflow-cli-'));
  try{
    assert.equal(run(root,['init']).status,0);
    assert.equal(run(root,['workflow','create','smoke','--empty']).status,0);
    assert.equal(run(root,['workflow','add','smoke','--','doctor']).status,0);
    assert.equal(run(root,['workflow','add','smoke','--','discover']).status,0);
    const steps=run(root,['workflow','steps','smoke']);
    assert.equal(steps.status,0);
    assert.match(steps.stdout,/senten doctor/);
    assert.match(steps.stdout,/senten discover/);
    const validation=run(root,['workflow','validate','smoke']);
    assert.equal(validation.status,0);
    assert.match(validation.stdout,/VALIDATION PASS/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('sandbox run misuse explains the standalone command separator', async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-sandbox-cli-'));
  try{
    assert.equal(run(root,['init']).status,0);
    const created=run(root,['sandbox','create']);
    assert.equal(created.status,0);
    const match=created.stdout.match(/SANDBOX CREATED\s+(sbx_[a-z0-9]+)/i);
    assert.ok(match);
    const misuse=run(root,['sandbox','run',match![1]!, '--node','--version']);
    assert.notEqual(misuse.status,0);
    assert.match(misuse.stderr,/missing the command separator/i);
    assert.match(misuse.stderr,/-- node --version/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('create sandbox is a friendly alias for sandbox create', async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-create-sandbox-'));
  try{
    assert.equal(run(root,['init']).status,0);
    const result=run(root,['create','sandbox']);
    assert.equal(result.status,0);
    assert.match(result.stdout,/SANDBOX CREATED/);
    assert.match(result.stdout,/Provider\s+local/);
  } finally { await rm(root,{recursive:true,force:true}); }
});


test('CLI exposes a concise first-run welcome surface', async()=>{
  const source=await readFile('packages/cli/src/index.ts','utf8');
  assert.match(source,/Architecture for Living Software/);
  assert.match(source,/Runtime  Node\.js >=22\.5 \(canonical\)/);
  assert.match(source,/Bun      experimental compatibility target/);
  assert.match(source,/✓ Senten initialized/);
});

test('MCP schema exposes the Build 12-20 command surface', async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-mcp-schema-'));
  try{
    const result=run(root,['mcp','schema']);
    assert.equal(result.status,0);
    const schema=JSON.parse(result.stdout) as {tools:Array<{name:string}>};
    const names=new Set(schema.tools.map(x=>x.name));
    for(const name of ['senten_adopt','senten_why','senten_lineage','senten_capability','senten_simulate','senten_compatibility']) assert.ok(names.has(name),name);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('safe simulation plans can be listed and inspected without executing faults', async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-sim-cli-'));
  try{
    assert.equal(run(root,['init']).status,0);
    const created=run(root,['simulate','provider','--target','capability:ai','--value','unavailable','--json']);
    assert.equal(created.status,0);
    const plan=JSON.parse(created.stdout) as {id:string;mode:string};
    assert.equal(plan.mode,'declarative');
    const listed=run(root,['simulate','list','--json']);
    assert.equal(listed.status,0); assert.match(listed.stdout,new RegExp(plan.id));
    const inspected=run(root,['simulate','inspect',plan.id,'--json']);
    assert.equal(inspected.status,0); assert.match(inspected.stdout,/credentials|production/i) === undefined;
    assert.match(inspected.stdout,/declarative/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('agent handoff applies target-agent grants and writes a scoped context artifact', async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-agent-handoff-'));
  try{
    assert.equal(run(root,['init']).status,0);
    assert.equal(run(root,['agent','create','planner']).status,0);
    assert.equal(run(root,['agent','create','implementer']).status,0);
    assert.equal(run(root,['agent','grant','implementer','project.read']).status,0);
    const result=run(root,['agent','handoff','planner','implementer','--task','inspect architecture','--json']);
    assert.equal(result.status,0);
    const handoff=JSON.parse(result.stdout) as {toAgentId:string;permissions:{allow:string[]};policy:string};
    assert.equal(handoff.toAgentId,'implementer'); assert.ok(handoff.permissions.allow.includes('project.read')); assert.match(handoff.policy,/credentials excluded/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

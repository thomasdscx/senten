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

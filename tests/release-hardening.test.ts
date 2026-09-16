import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStateStore } from '../packages/local-state/src/index.js';
import { runReleaseReadiness, benchmark } from '../packages/release-readiness/src/index.js';

test('local state migrations expose schema version and integrity', async () => {
  const root=await mkdtemp(join(tmpdir(),'senten-schema-'));
  try {
    await mkdir(join(root,'.senten'),{recursive:true});
    const store=await LocalStateStore.open(root);
    try {
      assert.equal(store.schemaVersion(),10);
      assert.equal(store.integrityCheck(),'ok');
      assert.ok(store.listMigrations().some(m=>m.version===10));
    } finally { store.close(); }
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('release readiness fails closed when required project state is missing', async () => {
  const root=await mkdtemp(join(tmpdir(),'senten-release-missing-'));
  try {
    const report=await runReleaseReadiness(root);
    assert.equal(report.ready,false);
    assert.ok(report.errors>=1);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('release readiness accepts a minimal healthy Senten project', async () => {
  const root=await mkdtemp(join(tmpdir(),'senten-release-ok-'));
  try {
    await mkdir(join(root,'.senten'),{recursive:true});
    await writeFile(join(root,'senten.config.json'),JSON.stringify({application:{id:'demo',name:'Demo'}},null,2));
    await writeFile(join(root,'.senten','state-truss.json'),JSON.stringify({schemaVersion:'0.1',application:{id:'demo',name:'Demo'},nodes:[],edges:[],generatedAt:new Date().toISOString()},null,2));
    await writeFile(join(root,'package.json'),JSON.stringify({name:'demo',version:'1.0.0',license:'Apache-2.0'},null,2));
    for(const file of ['README.md','LICENSE','SECURITY.md','CONTRIBUTING.md'])await writeFile(join(root,file),'ok');
    const store=await LocalStateStore.open(root);store.close();
    const report=await runReleaseReadiness(root);
    assert.equal(report.ready,true);
    assert.equal(report.errors,0);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('benchmark returns bounded timing data', async () => {
  const result=await benchmark('noop',3,async()=>undefined);
  assert.equal(result.iterations,3);
  assert.ok(result.averageMs>=0);
  assert.ok(result.maxMs>=result.minMs);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitHubRepositoryProvider } from '../packages/repository/src/index.js';
import { learningStorage, pruneLearningStorage } from '../packages/learning/src/index.js';

test('github provider parses supported repository references without credentials', () => {
  const p=new GitHubRepositoryProvider('test-token');
  assert.deepEqual(p.parse('facebook/react'),{provider:'github',owner:'facebook',repo:'react'});
  assert.deepEqual(p.parse('github:facebook/react'),{provider:'github',owner:'facebook',repo:'react'});
  assert.deepEqual(p.parse('https://github.com/facebook/react.git'),{provider:'github',owner:'facebook',repo:'react'});
  assert.throws(()=>p.parse('https://example.com/a/b'),/Expected GitHub repository/);
});

test('learning storage is compact, inspectable, and pruneable', async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-learn-storage-'));
  try{
    const source=join(root,'.senten','learn','sources','acme-demo');await mkdir(source,{recursive:true});
    await writeFile(join(source,'senten-knowledge-source.json'),JSON.stringify({schemaVersion:2,rawSourceRetained:false})+'\n');
    const report=await learningStorage(root);assert.equal(report.sources.length,1);assert.ok(report.totalBytes>0);assert.equal(report.sources[0]?.name,'acme-demo');
    assert.equal(await pruneLearningStorage(root,'acme-demo'),1);assert.equal((await learningStorage(root)).sources.length,0);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('external learning uses GitHub API metadata and retains no raw source tree', async()=>{
  const root=await mkdtemp(join(tmpdir(),'senten-remote-learn-'));
  const originalFetch=globalThis.fetch;const oldToken=process.env.SENTEN_GITHUB_TOKEN;process.env.SENTEN_GITHUB_TOKEN='unit-test-token';
  const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  globalThis.fetch=(async(input:URL|RequestInfo)=>{
    const url=String(input);
    if(url.endsWith('/repos/acme/demo'))return json({default_branch:'main',private:true,permissions:{pull:true}});
    if(url.includes('/commits/main'))return json({sha:'commit123',commit:{tree:{sha:'tree123'}}});
    if(url.includes('/git/trees/tree123?recursive=1'))return json({sha:'tree123',truncated:false,tree:[{path:'package.json',type:'blob',sha:'pkgsha',size:120},{path:'src/index.ts',type:'blob',sha:'srcsha',size:50},{path:'.env',type:'blob',sha:'secret',size:40}]});
    if(url.includes('/contents/package.json')){const content=Buffer.from(JSON.stringify({name:'demo',dependencies:{react:'19.0.0'}})).toString('base64');return json({type:'file',encoding:'base64',content,sha:'pkgsha',size:content.length});}
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  try{
    const { ingestExternalSource }=await import('../packages/learning/src/index.js');
    const result=await ingestExternalSource(root,'acme/demo');
    assert.equal(result.record.rawSourceRetained,false);assert.deepEqual(result.record.knowledge.frameworkHints,['react']);assert.ok(!result.inventory.manifests.includes('.env'));
    const metadata=JSON.parse(await readFile(result.metadataPath,'utf8')) as {rawSourceRetained:boolean};assert.equal(metadata.rawSourceRetained,false);
    const sourceEntries=await import('node:fs/promises').then(m=>m.readdir(result.root));assert.deepEqual(sourceEntries,['senten-knowledge-source.json']);
  }finally{globalThis.fetch=originalFetch;if(oldToken===undefined)delete process.env.SENTEN_GITHUB_TOKEN;else process.env.SENTEN_GITHUB_TOKEN=oldToken;await rm(root,{recursive:true,force:true});}
});

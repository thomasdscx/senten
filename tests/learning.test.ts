import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ApplicationIR } from '../packages/core/src/index.js';
import { buildKnowledgePack, inferProjectKnowledge, inventoryProject, loadKnowledgePack, updateLearningCandidate, writeLearningSnapshot } from '../packages/learning/src/index.js';

async function cleanup(path:string){await rm(path,{recursive:true,force:true,maxRetries:8,retryDelay:75});}

function fixtureIR():ApplicationIR{return {schemaVersion:'0.1',application:{id:'fixture',name:'Fixture'},nodes:[
  {id:'module:web',kind:'module',label:'web'},
  {id:'route:/users',kind:'route',label:'/users',source:'src/routes/users.ts',metadata:{framework:'next'}},
  {id:'route:/teams',kind:'route',label:'/teams',source:'src/routes/teams.ts',metadata:{framework:'next'}},
  {id:'action:createUser@src/users.ts',kind:'action',label:'createUser',source:'src/users.ts'},
  {id:'action:createTeam@src/teams.ts',kind:'action',label:'createTeam',source:'src/teams.ts'},
  {id:'provider:package/react',kind:'provider',label:'react',metadata:{package:'react'}}
],edges:[],generatedAt:new Date().toISOString()};}

test('learning inventories languages without requiring a language-specific adapter',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-learn-inventory-'));
  try{await mkdir(join(cwd,'src'),{recursive:true});await writeFile(join(cwd,'src','main.rs'),'fn main() {}');await writeFile(join(cwd,'src','tool.py'),'print(1)');await writeFile(join(cwd,'Cargo.toml'),'[package]\nname="demo"\n');
    const inv=await inventoryProject(cwd);assert.ok(inv.languages.some(x=>x.language==='Rust'&&x.files===1));assert.ok(inv.languages.some(x=>x.language==='Python'&&x.files===1));assert.ok(inv.manifests.includes('Cargo.toml'));
  }finally{await cleanup(cwd);}
});

test('learning creates evidence-backed candidates and preserves human status on relearn',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-learn-project-'));
  try{await mkdir(join(cwd,'src'),{recursive:true});await writeFile(join(cwd,'src','a.ts'),'export const a=1');await writeFile(join(cwd,'src','b.ts'),'export const b=2');
    let snap=await inferProjectKnowledge(cwd,fixtureIR());assert.ok(snap.candidates.some(c=>c.subject==='action-prefix:create'));assert.ok(snap.candidates.some(c=>c.subject==='framework:next'));
    await writeLearningSnapshot(cwd,snap);const target=snap.candidates.find(c=>c.subject==='action-prefix:create')!;await updateLearningCandidate(cwd,target.id,'approved');
    const previous=(await import('../packages/learning/src/index.js')).readLearningSnapshot;const saved=await previous(cwd);snap=await inferProjectKnowledge(cwd,fixtureIR(),saved!.candidates);assert.equal(snap.candidates.find(c=>c.id===target.id)?.status,'approved');
  }finally{await cleanup(cwd);}
});

test('approved knowledge can be packaged and integrity-verified',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'senten-learn-pack-'));
  try{await writeFile(join(cwd,'a.ts'),'export const a=1');await writeFile(join(cwd,'b.ts'),'export const b=2');let snap=await inferProjectKnowledge(cwd,fixtureIR());snap.candidates[0]!.status='approved';const built=await buildKnowledgePack(cwd,'team-platform','0.1.0',snap.candidates);assert.equal(built.manifest.kind,'knowledge-pack');const loaded=await loadKnowledgePack(built.root);assert.equal(loaded.payload.knowledge.length,1);assert.equal(loaded.manifest.name,'team-platform');
  }finally{await cleanup(cwd);}
});

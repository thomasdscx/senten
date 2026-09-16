import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgent, addGrant, permissionDecision, buildTaskContext, commandCapability, buildChangeBundle } from '../packages/agent-intelligence/src/index.js';
import type { ApplicationIR, MemoryRecord, OperationRecord, AgentRunRecord } from '../packages/core/src/index.js';

const human={type:'human' as const,id:'tester'};

test('agents fail closed until explicitly granted',()=>{
  let agent=createAgent({name:'codex',actor:human});
  assert.equal(permissionDecision(agent,'project.read').allowed,false);
  agent=addGrant(agent,{effect:'allow',capability:'project.read',actor:human});
  assert.equal(permissionDecision(agent,'project.read').allowed,true);
  agent=addGrant(agent,{effect:'deny',capability:'project.write',actor:human});
  assert.equal(permissionDecision(agent,'project.write').allowed,false);
});

test('task context selects relevant semantics, memory and permissions',()=>{
  let agent=createAgent({name:'builder',actor:human});
  agent=addGrant(agent,{effect:'allow',capability:'project.read',actor:human});
  const ir:ApplicationIR={schemaVersion:'0.1',application:{id:'app',name:'App'},generatedAt:new Date().toISOString(),nodes:[
    {id:'feature:billing',kind:'feature',label:'Billing'},
    {id:'feature:profile',kind:'feature',label:'Profile'},
    {id:'action:invoice.create',kind:'action',label:'Create invoice'}
  ],edges:[{from:'feature:billing',to:'action:invoice.create',relation:'contains'}]};
  const memory:MemoryRecord[]=[{id:'m1',kind:'decision',scope:'project',subject:'billing',value:'Invoices require audit logging',source:'test',actor:human,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',status:'active'}];
  const bundle=buildTaskContext({task:'change billing invoice creation',agent,ir,memory,operations:[]});
  assert.ok(bundle.semantic.nodes.some(n=>n.id==='feature:billing'));
  assert.ok(bundle.memory.some(m=>m.id==='m1'));
  assert.ok(bundle.constraints.some(c=>c.includes('audit logging')));
  assert.ok(bundle.permissions.allow.includes('project.read'));
});

test('command capabilities and change bundles preserve provenance',()=>{
  assert.equal(commandCapability('inspect'),'project.read');
  assert.equal(commandCapability('element'),'project.write');
  const op:OperationRecord={id:'op1',timestamp:'2026-01-01T00:00:00Z',actor:{type:'agent',id:'codex'},intent:'edit',action:'create',targets:['file:a.ts'],environment:'development',dryRun:false,status:'applied',reversibility:'reversible'};
  const run:AgentRunRecord={id:'ar1',agentId:'codex',command:'element',args:['a.ts'],startedAt:'2026-01-01T00:00:00Z',status:'passed',operationIds:['op1'],contextBundleId:'ctx1'};
  const bundle=buildChangeBundle({intent:'edit',run,operations:[op],actor:{type:'agent',id:'codex'},contextBundleId:'ctx1'});
  assert.equal(bundle.provenance.agentId,'codex');
  assert.equal(bundle.operations.length,1);
});

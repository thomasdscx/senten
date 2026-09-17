import { createHash, randomUUID } from 'node:crypto';
import type { AgentProfile, AgentGrant, ActorIdentity, ApplicationIR, MemoryRecord, OperationRecord, TaskContextBundle, ChangeBundle, AgentRunRecord } from '../../core/src/index.js';

export function createAgent(input:{name:string;id?:string;provider?:string;model?:string;description?:string;actor:ActorIdentity}):AgentProfile{
  const now=new Date().toISOString();
  return {id:input.id??slug(input.name),name:input.name,...(input.provider?{provider:input.provider}:{}),...(input.model?{model:input.model}:{}),...(input.description?{description:input.description}:{}),status:'active',grants:[],createdAt:now,updatedAt:now,metadata:{createdBy:input.actor}};
}

export function addGrant(agent:AgentProfile,input:{effect:'allow'|'deny';capability:string;target?:string;actor:ActorIdentity}):AgentProfile{
  const grant:AgentGrant={id:`grant_${randomUUID().slice(0,8)}`,effect:input.effect,capability:input.capability,...(input.target?{target:input.target}:{}),createdAt:new Date().toISOString(),actor:input.actor};
  return {...agent,grants:[...agent.grants,grant],updatedAt:new Date().toISOString()};
}

export function removeGrant(agent:AgentProfile,id:string):AgentProfile{
  return {...agent,grants:agent.grants.filter(g=>g.id!==id),updatedAt:new Date().toISOString()};
}

export function permissionDecision(agent:AgentProfile,capability:string,target?:string):{allowed:boolean;reason:string}{
  if(agent.status!=='active')return{allowed:false,reason:'agent disabled'};
  const matching=agent.grants.filter(g=>matches(g.capability,capability)&&(!g.target||!target||matches(g.target,target)));
  const deny=matching.find(g=>g.effect==='deny'); if(deny)return{allowed:false,reason:`denied by ${deny.id}`};
  const allow=matching.find(g=>g.effect==='allow'); if(allow)return{allowed:true,reason:`allowed by ${allow.id}`};
  return{allowed:false,reason:`no explicit grant for ${capability}`};
}

export function commandCapability(command:string):string{
  const readOnly=new Set(['inspect','explain','why','graph','impact','history','recall','source','diff','drift','paths','doctor','proof','guarantee','extensions','report','observatory','assurance','compatibility']);
  if(readOnly.has(command))return 'project.read';
  if(command==='discover'||command==='adopt'||command==='declare'||command==='relate')return 'semantic.write';
  if(command==='crawl'||command==='clickthru'||command==='journey')return 'interaction.execute';
  if(command==='runtime')return 'runtime.observe';
  if(command==='evidence')return 'evidence.write';
  if(command==='launchproof')return 'evidence.write';
  if(command==='sandbox'||command==='simulate')return 'sandbox.execute';
  if(command==='workflow')return 'workflow.execute';
  if(command==='capability')return 'capability.manage';
  if(['element','create','undo','redo','rollback','template','blueprint','profile','memory','checkpoint','session','transaction','registry','package'].includes(command))return 'project.write';
  return `command.${command}`;
}

export function buildTaskContext(input:{task:string;agent?:AgentProfile;ir:ApplicationIR;memory:MemoryRecord[];operations:OperationRecord[];maxNodes?:number;maxMemory?:number;maxOperations?:number}):TaskContextBundle{
  const tokens=keywords(input.task);
  const scored=input.ir.nodes.map(n=>({n,score:scoreText(`${n.id} ${n.label??''} ${n.source??''} ${JSON.stringify(n.metadata??{})}`,tokens)})).sort((a,b)=>b.score-a.score||a.n.id.localeCompare(b.n.id));
  const chosen=scored.filter(x=>x.score>0).slice(0,input.maxNodes??40).map(x=>x.n);
  const chosenIds=new Set(chosen.map(n=>n.id));
  const edges=input.ir.edges.filter(e=>chosenIds.has(e.from)||chosenIds.has(e.to)).slice(0,120);
  const mem=input.memory.map(m=>({m,score:scoreText(`${m.subject??''} ${m.value} ${m.kind}`,tokens)})).sort((a,b)=>b.score-a.score).filter(x=>x.score>0||['rule','decision','instruction'].includes(x.m.kind)).slice(0,input.maxMemory??30).map(x=>x.m);
  const operations=input.operations.slice(-(input.maxOperations??20));
  const allow=input.agent?.grants.filter(g=>g.effect==='allow').map(g=>g.capability)??[];
  const deny=input.agent?.grants.filter(g=>g.effect==='deny').map(g=>g.capability)??[];
  const constraints=mem.filter(m=>m.kind==='rule'||m.kind==='instruction'||m.kind==='decision').map(m=>`${m.kind}:${m.subject??m.id} — ${m.value}`);
  const digest=sha(JSON.stringify({task:input.task,nodes:chosen.map(n=>n.id),memory:mem.map(m=>m.id),ops:operations.map(o=>o.id),agent:input.agent?.id}));
  return {id:`ctx_${digest.slice(0,12)}`,task:input.task,...(input.agent?{agentId:input.agent.id}:{}),generatedAt:new Date().toISOString(),application:input.ir.application,semantic:{nodes:chosen,edges},memory:mem,recentOperations:operations,constraints,permissions:{allow,deny},sourceDigest:digest};
}

export function buildChangeBundle(input:{intent:string;run?:AgentRunRecord;operations:OperationRecord[];actor:ActorIdentity;contextBundleId?:string}):ChangeBundle{
  return {id:`chg_${randomUUID().slice(0,8)}`,...(input.run?{agentRunId:input.run.id}:{}),createdAt:new Date().toISOString(),intent:input.intent,operations:input.operations,provenance:{actor:input.actor,...(input.run?{agentId:input.run.agentId}:{}),...(input.contextBundleId?{contextBundleId:input.contextBundleId}:{})}};
}

function matches(pattern:string,value:string):boolean{
  if(pattern==='*'||pattern===value)return true;
  if(pattern.endsWith('.*'))return value.startsWith(pattern.slice(0,-1));
  return false;
}
function keywords(s:string):string[]{return [...new Set(s.toLowerCase().split(/[^a-z0-9_./:-]+/).filter(x=>x.length>=3))];}
function scoreText(text:string,tokens:string[]):number{const t=text.toLowerCase();return tokens.reduce((n,k)=>n+(t.includes(k)?1:0),0);}
function sha(v:string):string{return createHash('sha256').update(v).digest('hex');}
function slug(v:string):string{return v.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/(^-|-$)/g,'')||`agent-${randomUUID().slice(0,6)}`;}

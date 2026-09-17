import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { ApplicationIR } from '../../core/src/index.js';

export interface AdoptionSignal { id:string; category:'framework'|'route'|'auth'|'data'|'environment'|'ci'|'test'|'risk'; label:string; evidence:string[]; confidence:'high'|'medium'|'low'; }
export interface AdoptionGap { id:string; severity:'info'|'warning'|'critical'; category:'security'|'testing'|'architecture'|'operations'; message:string; evidence:string[]; }
export interface AdoptionReport { generatedAt:string; application:ApplicationIR['application']; summary:{files:number;routes:number;actions:number;resources:number;providers:number;tests:number}; signals:AdoptionSignal[]; gaps:AdoptionGap[]; recommendations:string[]; coverage:{semantic:number;operational:number}; readiness:{status:'early'|'developing'|'integrated'; score:number}; workspace:{kind:'single-package'|'npm-workspaces'|'pnpm-workspace'|'yarn-workspaces'|'unknown'; packageManager?:string}; }

async function exists(path:string):Promise<boolean>{try{await access(path);return true}catch{return false}}
async function readJson(path:string):Promise<Record<string,unknown>|undefined>{try{return JSON.parse(await readFile(path,'utf8')) as Record<string,unknown>}catch{return undefined}}
async function list(dir:string):Promise<string[]>{try{return await readdir(dir)}catch{return []}}

export async function analyzeAdoption(cwd:string,ir:ApplicationIR):Promise<AdoptionReport>{
  const signals:AdoptionSignal[]=[]; const pkg=await readJson(join(cwd,'package.json')); const deps={...((pkg?.dependencies??{}) as Record<string,string>),...((pkg?.devDependencies??{}) as Record<string,string>)};
  const packageManager=typeof pkg?.packageManager==='string'?pkg.packageManager:undefined; const hasPnpm=await exists(join(cwd,'pnpm-workspace.yaml')); const hasWorkspaces=Array.isArray(pkg?.workspaces)||Boolean(pkg?.workspaces&&typeof pkg.workspaces==='object'); const workspaceKind=hasPnpm?'pnpm-workspace':hasWorkspaces?(packageManager?.startsWith('yarn')?'yarn-workspaces':'npm-workspaces'):'single-package';
  const add=(id: string,category:AdoptionSignal['category'],label:string,evidence:string[],confidence:AdoptionSignal['confidence']='high')=>signals.push({id,category,label,evidence,confidence});
  const fw:[string,string][]=[['next','Next.js'],['react','React'],['vue','Vue'],['svelte','Svelte'],['@angular/core','Angular'],['express','Express'],['fastify','Fastify'],['hono','Hono'],['@supabase/supabase-js','Supabase']];
  for(const [key,label] of fw)if(deps[key])add(`framework.${key}`,'framework',label,[`package:${key}@${deps[key]}`]);
  if(deps['next-auth']||deps['@auth/core'])add('auth.authjs','auth','Auth.js',[deps['next-auth']?'package:next-auth':'package:@auth/core']);
  if(deps['@clerk/nextjs']||deps['@clerk/clerk-sdk-node'])add('auth.clerk','auth','Clerk',['package:@clerk/*']);
  if(deps['prisma']||deps['@prisma/client'])add('data.prisma','data','Prisma ORM',['package:prisma']);
  if(deps['drizzle-orm'])add('data.drizzle','data','Drizzle ORM',['package:drizzle-orm']);
  const envFiles=(await list(cwd)).filter(x=>/^\.env(?:\.|$)/.test(x)); if(envFiles.length)add('environment.files','environment','Environment configuration',envFiles.map(x=>`file:${x}`),'medium');
  const workflows=await list(join(cwd,'.github','workflows')); if(workflows.length)add('ci.github','ci','GitHub Actions',workflows.map(x=>`file:.github/workflows/${x}`));
  const routes=ir.nodes.filter(n=>n.kind==='route'); if(routes.length)add('routes.discovered','route',`${routes.length} application routes`,routes.slice(0,20).map(n=>n.id));
  const tests=ir.nodes.filter(n=>n.kind==='test'); if(tests.length)add('tests.discovered','test',`${tests.length} tests`,tests.slice(0,20).map(n=>n.id));
  if(await exists(join(cwd,'Dockerfile')))add('runtime.docker','environment','Docker runtime',['file:Dockerfile']);
  const packageScripts=(pkg?.scripts??{}) as Record<string,string>; if(!packageScripts.test)add('risk.no-test-script','risk','No package test script',['package.json#scripts'],'medium');
  if(routes.length&&!ir.nodes.some(n=>n.kind==='policy'))add('risk.no-policy-model','risk','Routes exist but no explicit Senten policy nodes are declared',routes.slice(0,5).map(n=>n.id),'medium');
  const counts={files:ir.nodes.filter(n=>n.kind==='file').length,routes:routes.length,actions:ir.nodes.filter(n=>n.kind==='action').length,resources:ir.nodes.filter(n=>n.kind==='resource').length,providers:ir.nodes.filter(n=>n.kind==='provider').length,tests:tests.length};
  const semanticKinds=['route','action','resource','provider','component','test']; const present=semanticKinds.filter(k=>ir.nodes.some(n=>n.kind===k)).length; const semantic=Math.round((present/semanticKinds.length)*100);
  const operationalChecks=[workflows.length>0,Boolean(packageScripts.test),await exists(join(cwd,'Dockerfile')),envFiles.length>0]; const operational=Math.round(operationalChecks.filter(Boolean).length/operationalChecks.length*100);
  const gaps:AdoptionGap[]=[]; const gap=(id: string,severity:AdoptionGap['severity'],category:AdoptionGap['category'],message:string,evidence:string[]=[])=>gaps.push({id,severity,category,message,evidence});
  if(routes.length&&!ir.nodes.some(n=>n.kind==='policy'))gap('security.routes-without-policy','critical','security','Externally reachable routes are present but no explicit policy nodes are modeled.',routes.slice(0,10).map(n=>n.id));
  if((routes.length||ir.nodes.some(n=>n.kind==='action'))&&!ir.nodes.some(n=>n.kind==='invariant'))gap('architecture.no-invariants','warning','architecture','No invariants are declared for discovered application behavior.');
  if(!tests.length)gap('testing.no-linked-tests','warning','testing','No tests are represented in the semantic graph.');
  if(!workflows.length)gap('operations.no-ci','warning','operations','No GitHub Actions workflows were detected.');
  if(!packageScripts.test)gap('testing.no-test-script','warning','testing','package.json has no test script.',['package.json#scripts']);
  const recommendations:string[]=[]; const expectsRoutes=Boolean(deps.next||deps.vue||deps.svelte||deps['@angular/core']||deps.express||deps.fastify||deps.hono); if(expectsRoutes&&!routes.length)recommendations.push('Add or improve framework adapters so externally reachable routes are represented.'); if(!ir.nodes.some(n=>n.kind==='policy'))recommendations.push('Declare authorization/security policies for privileged actions and routes.'); if(!ir.nodes.some(n=>n.kind==='invariant'))recommendations.push('Declare high-value invariants so Senten can track guarantees over time.'); if(!tests.length)recommendations.push('Connect test files to guarantees and critical routes/actions.'); if(!workflows.length)recommendations.push('Add a deterministic pre-release workflow and CI integration.');
  const deductions=gaps.reduce((total,g)=>total+(g.severity==='critical'?25:g.severity==='warning'?10:2),0); const score=Math.max(0,Math.min(100,Math.round((semantic+operational)/2)-deductions)); const status=score>=75?'integrated':score>=40?'developing':'early';
  return {generatedAt:new Date().toISOString(),application:ir.application,summary:counts,signals,gaps,recommendations,coverage:{semantic,operational},readiness:{status,score},workspace:{kind:workspaceKind,...(packageManager?{packageManager}:{})}};
}

import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { ApplicationIR } from '../../core/src/index.js';

export interface AdoptionSignal { id:string; category:'framework'|'workspace'|'route'|'auth'|'data'|'environment'|'ci'|'test'|'risk'; label:string; evidence:string[]; confidence:'high'|'medium'|'low'; }
export interface AdoptionGap { id:string; severity:'info'|'warning'|'critical'; category:'security'|'testing'|'architecture'|'operations'; message:string; evidence:string[]; }
export type SecurityModelState='not-detected'|'detected-but-unmapped'|'modeled'|'tested'|'verified';
export interface CoverageDimension { id:string; label:string; applicable:boolean; score:number|null; weight:number; detail:string; }
export interface AdoptionReport {
  generatedAt:string; application:ApplicationIR['application'];
  summary:{files:number;routes:number;actions:number;resources:number;providers:number;tests:number};
  signals:AdoptionSignal[]; gaps:AdoptionGap[]; recommendations:string[];
  coverage:{semantic:number;operational:number;semanticBreakdown:CoverageDimension[];operationalBreakdown:CoverageDimension[]};
  security:{state:SecurityModelState;authMechanisms:string[];policyNodes:number;detail:string};
  readiness:{status:'early'|'developing'|'integrated'; score:number};
  workspace:{kind:'single-package'|'npm-workspaces'|'pnpm-workspace'|'yarn-workspaces'|'unknown'; packageManager?:string; gitRoot?:string; packages?:number};
}

async function exists(path:string):Promise<boolean>{try{await access(path);return true}catch{return false}}
async function readJson(path:string):Promise<Record<string,unknown>|undefined>{try{return JSON.parse(await readFile(path,'utf8')) as Record<string,unknown>}catch{return undefined}}
async function list(dir:string):Promise<string[]>{try{return await readdir(dir)}catch{return []}}

function gitRootFor(cwd:string):string|undefined{const r=spawnSync('git',['rev-parse','--show-toplevel'],{cwd,encoding:'utf8'});return r.status===0&&r.stdout.trim()?r.stdout.trim():undefined;}
async function discoveredFrameworks(cwd:string):Promise<string[]>{try{const raw=JSON.parse(await readFile(join(cwd,'.senten','cache','source','manifest.json'),'utf8')) as {frameworks?:string[]};return raw.frameworks??[];}catch{return [];}}
function weightedCoverage(dimensions:CoverageDimension[]):number{const active=dimensions.filter(d=>d.applicable&&d.score!==null);const total=active.reduce((n,d)=>n+d.weight,0);if(!total)return 100;return Math.round(active.reduce((n,d)=>n+(d.score??0)*d.weight,0)/total);}

export async function analyzeAdoption(cwd:string,ir:ApplicationIR):Promise<AdoptionReport>{
  const signals:AdoptionSignal[]=[]; const pkg=await readJson(join(cwd,'package.json')); const deps={...((pkg?.dependencies??{}) as Record<string,string>),...((pkg?.devDependencies??{}) as Record<string,string>)};
  const packageManager=typeof pkg?.packageManager==='string'?pkg.packageManager:undefined; const hasPnpm=await exists(join(cwd,'pnpm-workspace.yaml')); const hasWorkspaces=Array.isArray(pkg?.workspaces)||Boolean(pkg?.workspaces&&typeof pkg.workspaces==='object'); const workspaceKind=hasPnpm?'pnpm-workspace':hasWorkspaces?(packageManager?.startsWith('yarn')?'yarn-workspaces':'npm-workspaces'):'single-package'; const gitRoot=gitRootFor(cwd); const workspaceModules=ir.nodes.filter(n=>n.kind==='module'&&n.metadata?.workspacePackage===true);
  const add=(id: string,category:AdoptionSignal['category'],label:string,evidence:string[],confidence:AdoptionSignal['confidence']='high')=>signals.push({id,category,label,evidence,confidence});
  const fw:[string,string,string][]=[['next','Next.js','next'],['react','React','react'],['vue','Vue','vue'],['svelte','Svelte','svelte'],['@angular/core','Angular','angular'],['expo','Expo','expo'],['@tauri-apps/api','Tauri','tauri'],['express','Express','express'],['fastify','Fastify','fastify'],['hono','Hono','hono'],['@supabase/supabase-js','Supabase','supabase']];
  const discovered=new Set(await discoveredFrameworks(cwd));
  for(const [key,label,hint] of fw)if(deps[key]||discovered.has(hint))add(`framework.${hint}`,'framework',label,[deps[key]?`package:${key}@${deps[key]}`:`discovery:${hint}`]);
  if(workspaceKind!=='single-package')add('workspace.detected','workspace',`${workspaceKind}${packageManager?` / ${packageManager}`:''}`,workspaceModules.map(n=>n.id).slice(0,20));
  const authMechanisms:string[]=[];
  if(deps['next-auth']||deps['@auth/core']){authMechanisms.push('Auth.js');add('auth.authjs','auth','Auth.js',[deps['next-auth']?'package:next-auth':'package:@auth/core']);}
  if(deps['@clerk/nextjs']||deps['@clerk/clerk-sdk-node']){authMechanisms.push('Clerk');add('auth.clerk','auth','Clerk',['package:@clerk/*']);}
  if(deps['better-auth']){authMechanisms.push('Better Auth');add('auth.better-auth','auth','Better Auth',['package:better-auth']);}
  if(deps['prisma']||deps['@prisma/client'])add('data.prisma','data','Prisma ORM',['package:prisma']);
  if(deps['drizzle-orm'])add('data.drizzle','data','Drizzle ORM',['package:drizzle-orm']);
  if(deps['@supabase/supabase-js'])add('data.supabase','data','Supabase data API',['package:@supabase/supabase-js']);
  const envFiles=(await list(cwd)).filter(x=>/^\.env(?:\.|$)/.test(x)); if(envFiles.length)add('environment.files','environment','Environment configuration',envFiles.map(x=>`file:${x}`),'medium');
  const localWorkflows=await list(join(cwd,'.github','workflows')); const repoWorkflows=gitRoot&&gitRoot!==cwd?await list(join(gitRoot,'.github','workflows')):[]; const workflows=localWorkflows.length?localWorkflows:repoWorkflows; if(workflows.length)add('ci.github','ci',localWorkflows.length?'GitHub Actions':'GitHub Actions (repository root)',workflows.map(x=>gitRoot&&gitRoot!==cwd?`repo:${relative(cwd,join(gitRoot,'.github','workflows',x)).replaceAll('\\','/')}`:`file:.github/workflows/${x}`));
  const routes=ir.nodes.filter(n=>n.kind==='route'); if(routes.length)add('routes.discovered','route',`${routes.length} application routes`,routes.slice(0,20).map(n=>n.id));
  const tests=ir.nodes.filter(n=>n.kind==='test'); if(tests.length)add('tests.discovered','test',`${tests.length} tests`,tests.slice(0,20).map(n=>n.id));
  if(await exists(join(cwd,'Dockerfile')))add('runtime.docker','environment','Docker runtime',['file:Dockerfile']);
  const packageScripts=(pkg?.scripts??{}) as Record<string,string>; if(!packageScripts.test)add('risk.no-test-script','risk','No package test script',['package.json#scripts'],'medium');

  const policyNodes=ir.nodes.filter(n=>n.kind==='policy').length;
  const securityState:SecurityModelState=policyNodes>0?'modeled':authMechanisms.length?'detected-but-unmapped':'not-detected';
  if(routes.length&&securityState==='detected-but-unmapped')add('risk.auth-unmapped','risk',`${authMechanisms.join(', ')} detected, but route authorization is not mapped into Senten policy semantics`,routes.slice(0,5).map(n=>n.id),'medium');
  // Absence of an auth signal is not itself a security failure; privileged/sensitive behavior drives recommendations below.

  const counts={files:ir.nodes.filter(n=>n.kind==='file').length,routes:routes.length,actions:ir.nodes.filter(n=>n.kind==='action').length,resources:ir.nodes.filter(n=>n.kind==='resource').length,providers:ir.nodes.filter(n=>n.kind==='provider').length,tests:tests.length};
  const hasUI=Boolean(deps.react||deps.vue||deps.svelte||deps['@angular/core']||deps.next||deps.expo||discovered.has('react')||discovered.has('next')||discovered.has('expo')||discovered.has('vue')||discovered.has('angular'));
  const expectsRoutes=Boolean(deps.next||deps.vue||deps.svelte||deps['@angular/core']||deps.express||deps.fastify||deps.hono||deps.expo||deps['expo-router']||discovered.has('next')||discovered.has('expo'));
  const expectsResources=signals.some(s=>s.category==='data');
  const components=ir.nodes.filter(n=>n.kind==='component').length;const invariants=ir.nodes.filter(n=>n.kind==='invariant').length;
  const semanticBreakdown:CoverageDimension[]=[
    {id:'files',label:'Source files',applicable:true,score:counts.files?100:0,weight:10,detail:`${counts.files} represented`},
    {id:'routes',label:'Routes',applicable:expectsRoutes,score:expectsRoutes?(counts.routes?100:0):null,weight:15,detail:expectsRoutes?`${counts.routes} represented`:'not route-bearing'},
    {id:'actions',label:'Actions',applicable:counts.routes>0||counts.actions>0,score:(counts.routes>0||counts.actions>0)?(counts.actions?100:0):null,weight:15,detail:`${counts.actions} represented`},
    {id:'resources',label:'Resources',applicable:expectsResources,score:expectsResources?(counts.resources?100:0):null,weight:15,detail:expectsResources?`${counts.resources} represented`:'no data layer detected'},
    {id:'providers',label:'Providers',applicable:Object.keys(deps).length>0,score:Object.keys(deps).length?(counts.providers?100:0):null,weight:10,detail:`${counts.providers} represented`},
    {id:'components',label:'UI components',applicable:hasUI,score:hasUI?(components?100:0):null,weight:10,detail:hasUI?`${components} represented`:'no UI framework detected'},
    {id:'tests',label:'Tests',applicable:true,score:counts.tests?100:0,weight:10,detail:`${counts.tests} represented`},
    {id:'policies',label:'Policies',applicable:routes.length>0&&authMechanisms.length>0,score:(routes.length>0&&authMechanisms.length>0)?(policyNodes?100:0):null,weight:10,detail:securityState},
    {id:'invariants',label:'Invariants',applicable:counts.routes>0||counts.actions>0||counts.resources>0,score:(counts.routes>0||counts.actions>0||counts.resources>0)?(invariants?100:0):null,weight:5,detail:`${invariants} represented`}
  ];
  const semantic=weightedCoverage(semanticBreakdown);
  const hasDocker=await exists(join(cwd,'Dockerfile'));const operationalBreakdown:CoverageDimension[]=[
    {id:'ci',label:'CI',applicable:true,score:workflows.length?100:0,weight:30,detail:`${workflows.length} workflow(s)`},
    {id:'test-script',label:'Test command',applicable:true,score:packageScripts.test?100:0,weight:30,detail:packageScripts.test?'configured':'missing'},
    {id:'container',label:'Container/runtime contract',applicable:true,score:hasDocker?100:0,weight:20,detail:hasDocker?'Dockerfile present':'not detected'},
    {id:'environment',label:'Environment contract',applicable:true,score:envFiles.length?100:0,weight:20,detail:`${envFiles.length} env file(s)`}
  ];
  const operational=weightedCoverage(operationalBreakdown);

  const gaps:AdoptionGap[]=[]; const gap=(id: string,severity:AdoptionGap['severity'],category:AdoptionGap['category'],message:string,evidence:string[]=[])=>gaps.push({id,severity,category,message,evidence});
  const explicitlyUnprotected=routes.filter(n=>n.metadata?.security==='unprotected');
  if(explicitlyUnprotected.length)gap('security.routes-explicitly-unprotected','critical','security','One or more externally reachable routes are explicitly marked unprotected.',explicitlyUnprotected.map(n=>n.id));
  else if(routes.length&&securityState==='detected-but-unmapped')gap('security.auth-unmapped','warning','security',`${authMechanisms.join(', ')} is detected, but authorization behavior has not yet been mapped into Senten policy semantics.`,routes.slice(0,10).map(n=>n.id));
  else if(routes.length&&securityState==='not-detected'&&ir.nodes.some(n=>n.kind==='action'||n.kind==='resource'))gap('security.security-unmapped','info','security','Security status is unknown. Model policies if these routes expose privileged actions or sensitive resources.',routes.slice(0,10).map(n=>n.id));
  if((routes.length||ir.nodes.some(n=>n.kind==='action'))&&!invariants)gap('architecture.no-invariants','warning','architecture','No invariants are declared for discovered application behavior.');
  if(!tests.length)gap('testing.no-linked-tests','warning','testing','No tests are represented in the semantic graph.');
  if(!workflows.length)gap('operations.no-ci','warning','operations','No GitHub Actions workflows were detected.');
  if(!packageScripts.test)gap('testing.no-test-script','warning','testing','package.json has no test script.',['package.json#scripts']);
  if(expectsResources&&!counts.resources)gap('architecture.data-resources-unmapped','warning','architecture','A data/ORM layer is detected, but no resource nodes were extracted.',['data-layer']);

  const recommendations:string[]=[]; if(expectsRoutes&&!routes.length)recommendations.push('Add or improve framework adapters so externally reachable routes are represented.'); if(securityState==='detected-but-unmapped'||(securityState==='not-detected'&&ir.nodes.some(n=>n.kind==='action'||n.kind==='resource')))recommendations.push('Model authorization/security policies for privileged actions, protected routes, or sensitive resources where applicable.'); if(!invariants&&(routes.length||counts.actions||counts.resources))recommendations.push('Declare high-value invariants so Senten can track guarantees over time.'); if(!tests.length)recommendations.push('Connect test files to guarantees and critical routes/actions.'); if(!workflows.length)recommendations.push('Add a deterministic pre-release workflow and CI integration.'); if(expectsResources&&!counts.resources)recommendations.push('Improve data-layer adapters so ORM/schema entities are represented as resources.');
  const deductions=gaps.reduce((total,g)=>total+(g.severity==='critical'?25:g.severity==='warning'?6:2),0); const score=Math.max(0,Math.min(100,Math.round((semantic+operational)/2)-deductions)); const status=score>=75?'integrated':score>=40?'developing':'early';
  const securityDetail=securityState==='modeled'?`${policyNodes} explicit policy node(s)`:securityState==='detected-but-unmapped'?`${authMechanisms.join(', ')} detected; policy mapping pending`:'No recognized auth mechanism or explicit policy model detected; security status remains unknown';
  return {generatedAt:new Date().toISOString(),application:ir.application,summary:counts,signals,gaps,recommendations,coverage:{semantic,operational,semanticBreakdown,operationalBreakdown},security:{state:securityState,authMechanisms,policyNodes,detail:securityDetail},readiness:{status,score},workspace:{kind:workspaceKind,...(packageManager?{packageManager}:{}),...(gitRoot?{gitRoot}:{}) ,packages:workspaceModules.length}};
}

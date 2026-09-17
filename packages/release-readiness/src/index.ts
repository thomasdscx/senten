import { access, readFile, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, relative } from 'node:path';
import type { ApplicationIR, SentenConfig } from '../../core/src/index.js';
import { LocalStateStore } from '../../local-state/src/index.js';
import { compatibilityReport } from '../../stabilization/src/index.js';

export type ReadinessSeverity = 'error'|'warning'|'info';
export interface ReadinessCheck { id:string; label:string; status:'pass'|'fail'|'warn'; severity:ReadinessSeverity; detail:string; }
export interface ReleaseReadinessReport { version:1; generatedAt:string; project:string; checks:ReadinessCheck[]; errors:number; warnings:number; passed:number; ready:boolean; durationMs:number; }

async function exists(path:string):Promise<boolean>{try{await access(path,constants.F_OK);return true;}catch{return false;}}
function check(id:string,label:string,status:ReadinessCheck['status'],severity:ReadinessSeverity,detail:string):ReadinessCheck{return{id,label,status,severity,detail};}
function nodeAtLeast(major:number,minor:number):boolean{const [a,b]=process.versions.node.split('.').map(Number);return (a??0)>major||((a??0)===major&&(b??0)>=minor);}

export async function runReleaseReadiness(cwd:string):Promise<ReleaseReadinessReport>{
  const started=Date.now(); const checks:ReadinessCheck[]=[];
  checks.push(check('runtime.node','Supported Node runtime',nodeAtLeast(22,5)?'pass':'fail','error',`Node ${process.versions.node}; requires >=22.5`));
  const configPath=join(cwd,'senten.config.json');
  if(!await exists(configPath))checks.push(check('project.config','Senten configuration','fail','error','senten.config.json is missing'));
  else{
    try{const config=JSON.parse(await readFile(configPath,'utf8')) as SentenConfig;checks.push(check('project.config','Senten configuration',config.application?.id&&config.application?.name?'pass':'fail','error',`${config.application?.name??'unknown'} (${config.application?.id??'missing id'})`));}
    catch(error){checks.push(check('project.config','Senten configuration','fail','error',`Invalid JSON: ${error instanceof Error?error.message:String(error)}`));}
  }
  const irPath=join(cwd,'.senten','state-truss.json');
  if(!await exists(irPath))checks.push(check('state.ir','StateTruss IR','fail','error','.senten/state-truss.json is missing'));
  else{try{const ir=JSON.parse(await readFile(irPath,'utf8')) as ApplicationIR;checks.push(check('state.ir','StateTruss IR',Array.isArray(ir.nodes)&&Array.isArray(ir.edges)?'pass':'fail','error',`${ir.nodes?.length??0} nodes / ${ir.edges?.length??0} edges`));const compat=compatibilityReport(ir);checks.push(check('state.compatibility','Application IR compatibility',compat.compatible?'pass':'fail','error',compat.compatible?`schema ${compat.irSchema}`:compat.warnings.join('; ')));}catch(error){checks.push(check('state.ir','StateTruss IR','fail','error',`Invalid IR: ${error instanceof Error?error.message:String(error)}`));}}
  const dbPath=join(cwd,'.senten','senten.db');
  if(!await exists(dbPath))checks.push(check('state.db','Local state database','fail','error','.senten/senten.db is missing'));
  else{try{const store=await LocalStateStore.open(cwd);const integrity=store.integrityCheck();const schema=store.schemaVersion();store.close();checks.push(check('state.db','Local state database',integrity==='ok'?'pass':'fail','error',`integrity=${integrity}; schema=${schema}`));}catch(error){checks.push(check('state.db','Local state database','fail','error',error instanceof Error?error.message:String(error)));}}
  for(const file of ['README.md','LICENSE','SECURITY.md','CONTRIBUTING.md'])checks.push(check(`docs.${file.toLowerCase()}`,file,await exists(join(cwd,file))?'pass':'warn','warning',await exists(join(cwd,file))?'present':'missing'));
  const secretFiles:string[]=[];for(const name of ['.env','.env.local','.env.production','credentials.json','service-account.json'])if(await exists(join(cwd,name)))secretFiles.push(name);
  checks.push(check('security.root-secrets','Root secret files',secretFiles.length?'warn':'pass','warning',secretFiles.length?`Review before publishing: ${secretFiles.join(', ')}`:'No common root secret files detected'));
  const gitDir=join(cwd,'.git'); if(await exists(gitDir)){const trackedEnv=await detectTrackedSecrets(cwd);checks.push(check('security.git-secrets','Potential tracked secrets',trackedEnv.length?'fail':'pass','error',trackedEnv.length?`Potentially sensitive tracked files: ${trackedEnv.join(', ')}`:'No common sensitive filenames appear tracked'));}else checks.push(check('security.git-secrets','Potential tracked secrets','warn','warning','Not a Git working tree; tracked-file check skipped'));
  const pkgPath=join(cwd,'package.json'); if(await exists(pkgPath)){try{const pkg=JSON.parse(await readFile(pkgPath,'utf8')) as Record<string,unknown>;const license=pkg.license==='Apache-2.0';checks.push(check('package.license','Package license',license?'pass':'warn','warning',String(pkg.license??'missing')));const version=String(pkg.version??'');checks.push(check('package.version','Package version',/^\d+\.\d+\.\d+/.test(version)?'pass':'fail','error',version||'missing'));}catch{checks.push(check('package.root','Root package metadata','fail','error','package.json is invalid'));}}
  const errors=checks.filter(x=>x.status==='fail'&&x.severity==='error').length;const warnings=checks.filter(x=>x.status==='warn').length;const passed=checks.filter(x=>x.status==='pass').length;
  return{version:1,generatedAt:new Date().toISOString(),project:cwd,checks,errors,warnings,passed,ready:errors===0,durationMs:Date.now()-started};
}

async function detectTrackedSecrets(cwd:string):Promise<string[]>{
  const index=join(cwd,'.git','index'); if(!await exists(index))return[];
  // Avoid executing project code. Git itself is safe to query when available; fall back to filename scan.
  const candidates=['.env','.env.local','.env.production','credentials.json','service-account.json','id_rsa','id_ed25519'];
  const found:string[]=[];
  async function walk(dir:string):Promise<void>{for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name==='.git'||entry.name==='node_modules'||entry.name==='.senten')continue;const p=join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(candidates.includes(entry.name))found.push(relative(cwd,p).replaceAll('\\','/'));}}
  await walk(cwd); return found;
}

export interface BenchmarkResult { name:string; iterations:number; totalMs:number; averageMs:number; minMs:number; maxMs:number; }
export async function benchmark<T>(name:string,iterations:number,fn:()=>Promise<T>):Promise<BenchmarkResult>{const samples:number[]=[];for(let i=0;i<iterations;i++){const start=performance.now();await fn();samples.push(performance.now()-start);}const total=samples.reduce((a,b)=>a+b,0);return{name,iterations,totalMs:Number(total.toFixed(3)),averageMs:Number((total/iterations).toFixed(3)),minMs:Number(Math.min(...samples).toFixed(3)),maxMs:Number(Math.max(...samples).toFixed(3))};}

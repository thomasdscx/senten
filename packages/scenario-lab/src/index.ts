import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ApplicationIR } from '../../core/src/index.js';
import { discoverSourceProject } from '../../source-intelligence/src/index.js';
import { analyzeAdoption, type AdoptionReport } from '../../adoption/src/index.js';
import { nextAdapter } from '../../../adapters/next/src/index.js';
import { expoAdapter } from '../../../adapters/expo/src/index.js';
import { tauriAdapter } from '../../../adapters/tauri/src/index.js';
import { supabaseAdapter } from '../../../adapters/supabase/src/index.js';

export interface ScenarioExpectation { frameworks?:string[]; requiredNodeIds?:string[]; forbiddenNodeIds?:string[]; gapIds?:string[]; noGapIds?:string[]; readinessMin?:number; readinessMax?:number; }
export interface ScenarioDefinition { id:string; title:string; description:string; application:{id:string;name:string;version?:string}; expectations:ScenarioExpectation; }
export interface ScenarioResult { scenario:ScenarioDefinition; ir:ApplicationIR; adoption:AdoptionReport; frameworks:string[]; passed:boolean; failures:string[]; }

const analyzers=[
  {namespace:'next',analyzer:nextAdapter.sourceAnalyzers![0]!},
  {namespace:'expo',analyzer:expoAdapter.sourceAnalyzers![0]!},
  {namespace:'tauri',analyzer:tauriAdapter.sourceAnalyzers![0]!},
  {namespace:'supabase',analyzer:supabaseAdapter.sourceAnalyzers![0]!}
];

export async function listScenarios(root:string):Promise<ScenarioDefinition[]>{
  const dir=join(root,'examples','scenarios');const out:ScenarioDefinition[]=[];let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch{return out;}
  for(const name of entries.filter(x=>x.isDirectory()).map(x=>x.name).sort()){
    try{out.push(JSON.parse(await readFile(join(dir,name,'scenario.json'),'utf8')) as ScenarioDefinition);}catch{}
  }
  return out;
}
export async function runScenario(root:string,id:string):Promise<ScenarioResult>{
  const dir=join(root,'examples','scenarios',id);const scenario=JSON.parse(await readFile(join(dir,'scenario.json'),'utf8')) as ScenarioDefinition;
  const base:ApplicationIR={schemaVersion:'0.1',application:scenario.application,nodes:[],edges:[],generatedAt:new Date(0).toISOString()};
  const discovered=await discoverSourceProject(dir,scenario.application,base,{force:true,analyzers});
  const adoption=await analyzeAdoption(dir,discovered.ir);const failures:string[]=[];const e=scenario.expectations;
  for(const f of e.frameworks??[])if(!discovered.frameworks.includes(f))failures.push(`missing framework ${f}`);
  for(const n of e.requiredNodeIds??[])if(!discovered.ir.nodes.some(x=>x.id===n))failures.push(`missing node ${n}`);
  for(const n of e.forbiddenNodeIds??[])if(discovered.ir.nodes.some(x=>x.id===n))failures.push(`forbidden node ${n}`);
  for(const g of e.gapIds??[])if(!adoption.gaps.some(x=>x.id===g))failures.push(`missing gap ${g}`);
  for(const g of e.noGapIds??[])if(adoption.gaps.some(x=>x.id===g))failures.push(`unexpected gap ${g}`);
  if(e.readinessMin!==undefined&&adoption.readiness.score<e.readinessMin)failures.push(`readiness ${adoption.readiness.score} < ${e.readinessMin}`);
  if(e.readinessMax!==undefined&&adoption.readiness.score>e.readinessMax)failures.push(`readiness ${adoption.readiness.score} > ${e.readinessMax}`);
  return{scenario,ir:discovered.ir,adoption,frameworks:discovered.frameworks,passed:failures.length===0,failures};
}
export async function exportScenarioArtifacts(root:string,outDir:string):Promise<{count:number;failed:number;index:string}>{
  const scenarios=await listScenarios(root);await mkdir(outDir,{recursive:true});const index:any[]=[];let failed=0;
  for(const s of scenarios){const r=await runScenario(root,s.id);if(!r.passed)failed++;const payload={schemaVersion:'0.1',generatedAt:new Date().toISOString(),scenario:r.scenario,frameworks:r.frameworks,passed:r.passed,failures:r.failures,adoption:r.adoption,graph:{nodes:r.ir.nodes,edges:r.ir.edges}};await writeFile(join(outDir,`${s.id}.json`),JSON.stringify(payload,null,2)+'\n');index.push({id:s.id,title:s.title,description:s.description,passed:r.passed,readiness:r.adoption.readiness,gaps:r.adoption.gaps.length});}
  const path=join(outDir,'index.json');await writeFile(path,JSON.stringify({schemaVersion:'0.1',generatedAt:new Date().toISOString(),scenarios:index},null,2)+'\n');return{count:scenarios.length,failed,index:resolve(path)};
}

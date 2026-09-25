import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import type { ApplicationIR, MemoryRecord, SentenPackageManifest } from '../../core/src/index.js';
import { GitHubRepositoryProvider, repositoryFingerprint, type RepositorySnapshot } from '../../repository/src/index.js';

export type LearningCandidateKind = 'convention' | 'mapping' | 'framework-pattern' | 'dependency-pattern' | 'language-pattern';
export type LearningCandidateStatus = 'candidate' | 'approved' | 'rejected';
export interface LearningCandidate {
  id: string;
  kind: LearningCandidateKind;
  subject: string;
  value: string;
  confidence: number;
  evidence: string[];
  status: LearningCandidateStatus;
  createdAt: string;
  updatedAt: string;
  source: string;
  metadata?: Record<string, unknown>;
}
export interface LearningInventory {
  root: string;
  files: number;
  languages: Array<{ language:string; files:number }>;
  manifests: string[];
}
export interface LearningSnapshot {
  schemaVersion: 1;
  application: string;
  generatedAt: string;
  inventory: LearningInventory;
  candidates: LearningCandidate[];
}
export interface KnowledgePackPayload {
  schemaVersion: 1;
  name: string;
  version: string;
  generatedAt: string;
  sourceApplication?: string;
  knowledge: Array<Pick<LearningCandidate,'kind'|'subject'|'value'|'confidence'|'evidence'|'metadata'>>;
}

const IGNORE_DIRS = new Set(['.git','.senten','node_modules','dist','build','.next','.turbo','coverage','vendor','target','.dart_tool','.gradle','.idea','.vscode']);
const LANGUAGE_BY_EXT:Record<string,string> = {
  '.ts':'TypeScript','.tsx':'TypeScript','.mts':'TypeScript','.cts':'TypeScript',
  '.js':'JavaScript','.jsx':'JavaScript','.mjs':'JavaScript','.cjs':'JavaScript',
  '.py':'Python','.rs':'Rust','.go':'Go','.java':'Java','.kt':'Kotlin','.kts':'Kotlin',
  '.swift':'Swift','.dart':'Dart','.cs':'C#','.fs':'F#','.vb':'Visual Basic',
  '.c':'C','.h':'C/C++','.cc':'C++','.cpp':'C++','.cxx':'C++','.hpp':'C++',
  '.rb':'Ruby','.php':'PHP','.ex':'Elixir','.exs':'Elixir','.erl':'Erlang','.hrl':'Erlang',
  '.scala':'Scala','.lua':'Lua','.r':'R','.R':'R','.hs':'Haskell','.clj':'Clojure','.cljs':'Clojure',
  '.vue':'Vue SFC','.svelte':'Svelte','.html':'HTML','.htm':'HTML','.css':'CSS','.scss':'SCSS','.sass':'Sass','.less':'Less',
  '.sql':'SQL','.sh':'Shell','.bash':'Shell','.zsh':'Shell','.ps1':'PowerShell'
};
const MANIFESTS = new Set(['package.json','pyproject.toml','requirements.txt','Pipfile','poetry.lock','Cargo.toml','go.mod','pubspec.yaml','pom.xml','build.gradle','build.gradle.kts','settings.gradle','settings.gradle.kts','Gemfile','composer.json','mix.exs']);

function sha256(input:Buffer|string):string{return createHash('sha256').update(input).digest('hex');}
function safe(input:string):string{return input.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/(^-|-$)/g,'')||'knowledge';}
async function exists(path:string):Promise<boolean>{try{await access(path,constants.F_OK);return true;}catch{return false;}}

export async function inventoryProject(root:string):Promise<LearningInventory>{
  const counts=new Map<string,number>(); const manifests:string[]=[]; let files=0;
  async function walk(dir:string):Promise<void>{
    for(const entry of await readdir(dir,{withFileTypes:true})){
      if(entry.isDirectory()&&IGNORE_DIRS.has(entry.name))continue;
      const path=join(dir,entry.name); const rel=relative(root,path).replaceAll('\\','/');
      if(entry.isDirectory()){await walk(path);continue;}
      if(!entry.isFile())continue; files++;
      if(MANIFESTS.has(entry.name)||entry.name.endsWith('.csproj')||entry.name.endsWith('.fsproj'))manifests.push(rel);
      const language=LANGUAGE_BY_EXT[extname(entry.name)]; if(language)counts.set(language,(counts.get(language)??0)+1);
    }
  }
  await walk(root);
  return {root:resolve(root),files,languages:[...counts].map(([language,n])=>({language,files:n})).sort((a,b)=>b.files-a.files||a.language.localeCompare(b.language)),manifests:manifests.sort()};
}

function makeCandidate(kind:LearningCandidateKind,subject:string,value:string,confidence:number,evidence:string[],metadata?:Record<string,unknown>):LearningCandidate{
  const now=new Date().toISOString(); const digest=sha256(`${kind}\0${subject}\0${value}`).slice(0,10);
  return {id:`learn_${digest}`,kind,subject,value,confidence,evidence:[...new Set(evidence)],status:'candidate',createdAt:now,updatedAt:now,source:'senten.learn',...(metadata?{metadata}:{})};
}

export async function inferProjectKnowledge(root:string,ir:ApplicationIR,previous:LearningCandidate[]=[]):Promise<LearningSnapshot>{
  const inventory=await inventoryProject(root); const candidates:LearningCandidate[]=[];
  const prevById=new Map(previous.map(x=>[x.id,x]));
  for(const language of inventory.languages.slice(0,8)){
    const share=inventory.files?language.files/inventory.files:0;
    if(language.files>=2)candidates.push(makeCandidate('language-pattern',`language:${language.language}`,`${language.language} is used in ${language.files} source files`,Math.min(.99,.65+Math.min(.3,share)),[`${language.files} file(s) detected`],{files:language.files}));
  }
  const frameworks=new Set<string>(); for(const node of ir.nodes){const values=node.metadata?.frameworks;if(Array.isArray(values))for(const value of values)if(typeof value==='string'&&value)frameworks.add(value);const framework=node.metadata?.framework;if(typeof framework==='string'&&framework)frameworks.add(framework);}
  for(const framework of [...frameworks].sort())candidates.push(makeCandidate('framework-pattern',`framework:${framework}`,`${framework} semantics are active in this project`,.86,[`semantic graph contains ${framework} framework metadata`]));
  const modules=ir.nodes.filter(n=>n.kind==='module'); if(modules.length)candidates.push(makeCandidate('convention','workspace:modules',`Project uses ${modules.length} workspace/module boundaries`,.95,modules.slice(0,20).map(n=>n.id),{modules:modules.map(n=>n.id)}));
  const routes=ir.nodes.filter(n=>n.kind==='route'); if(routes.length){const roots=new Map<string,number>();for(const route of routes){const src=route.source??'';const parts=src.split('/');const root=parts.length>2?parts.slice(0,Math.min(3,parts.length-1)).join('/'):src;if(root)roots.set(root,(roots.get(root)??0)+1);}for(const [root,count] of roots)if(count>=2)candidates.push(makeCandidate('mapping',`route-root:${root}`,`${root} contains route implementations`,.9,routes.filter(r=>(r.source??'').startsWith(root)).map(r=>r.id),{count}));}
  const actionPrefixes=new Map<string,string[]>(); for(const node of ir.nodes.filter(n=>n.kind==='action')){const label=(node.label??node.id).replace(/^action:/,'');const m=label.match(/^(create|update|delete|remove|save|submit|send|handle|execute|run|get|list|find)/i);if(m){const key=m[1]!.toLowerCase();const list=actionPrefixes.get(key)??[];list.push(node.id);actionPrefixes.set(key,list);}}
  for(const [prefix,ids] of actionPrefixes)if(ids.length>=2)candidates.push(makeCandidate('convention',`action-prefix:${prefix}`,`Functions beginning with "${prefix}" commonly represent actions`,Math.min(.97,.72+ids.length*.04),ids));
  const resourceSuffixes=new Map<string,string[]>(); for(const node of ir.nodes.filter(n=>n.kind==='resource')){const label=node.label??node.id;const m=label.match(/(Entity|Model|Record|DTO|Dto|Payload|Input)$/);if(m){const key=m[1]!;const list=resourceSuffixes.get(key)??[];list.push(node.id);resourceSuffixes.set(key,list);}}
  for(const [suffix,ids] of resourceSuffixes)if(ids.length>=2)candidates.push(makeCandidate('convention',`resource-suffix:${suffix}`,`Symbols ending in "${suffix}" commonly represent resources/data contracts`,Math.min(.97,.74+ids.length*.04),ids));
  const providers=ir.nodes.filter(n=>n.kind==='provider'&&typeof n.metadata?.package==='string');for(const p of providers.slice(0,50))candidates.push(makeCandidate('dependency-pattern',`package:${String(p.metadata?.package)}`,`External package ${String(p.metadata?.package)} participates in the application architecture`,.78,[p.id]));
  const merged=[...new Map(candidates.map(c=>{const old=prevById.get(c.id);return[c.id,old?{...c,status:old.status,createdAt:old.createdAt,updatedAt:old.updatedAt}:c] as const;})).values()];
  return {schemaVersion:1,application:ir.application.name,generatedAt:new Date().toISOString(),inventory,candidates:merged.sort((a,b)=>b.confidence-a.confidence||a.subject.localeCompare(b.subject))};
}

export async function writeLearningSnapshot(root:string,snapshot:LearningSnapshot):Promise<string>{const dir=join(root,'.senten','learn');await mkdir(dir,{recursive:true});const path=join(dir,'candidates.json');await writeFile(path,JSON.stringify(snapshot,null,2)+'\n');return path;}
export async function readLearningSnapshot(root:string):Promise<LearningSnapshot|undefined>{const path=join(root,'.senten','learn','candidates.json');if(!await exists(path))return undefined;return JSON.parse(await readFile(path,'utf8')) as LearningSnapshot;}
export async function updateLearningCandidate(root:string,id:string,status:LearningCandidateStatus):Promise<LearningCandidate>{const snapshot=await readLearningSnapshot(root);if(!snapshot)throw new Error('No learning candidates found. Run: senten learn project');const candidate=snapshot.candidates.find(c=>c.id===id);if(!candidate)throw new Error(`Learning candidate not found: ${id}`);candidate.status=status;candidate.updatedAt=new Date().toISOString();await writeLearningSnapshot(root,snapshot);return candidate;}
export async function updateAllLearningCandidates(root:string,status:LearningCandidateStatus):Promise<LearningCandidate[]>{const snapshot=await readLearningSnapshot(root);if(!snapshot)throw new Error('No learning candidates found. Run: senten learn project');for(const candidate of snapshot.candidates){candidate.status=status;candidate.updatedAt=new Date().toISOString();}await writeLearningSnapshot(root,snapshot);return snapshot.candidates;}

export function candidateToMemory(candidate:LearningCandidate,application:string):Omit<MemoryRecord,'id'|'createdAt'|'updatedAt'> {
  return {kind:candidate.kind==='convention'?'convention':'fact',scope:'project',scopeId:application,subject:candidate.subject,value:candidate.value,source:'senten.learn',actor:{type:'human',id:'local'},confidence:candidate.confidence,status:'active',metadata:{learningCandidateId:candidate.id,evidence:candidate.evidence,learningKind:candidate.kind,...candidate.metadata}};
}

export async function buildKnowledgePack(root:string,name:string,version:string,candidates:LearningCandidate[]):Promise<{root:string;manifest:SentenPackageManifest;payload:KnowledgePackPayload}>{
  const approved=candidates.filter(c=>c.status==='approved');if(!approved.length)throw new Error('No approved learning candidates. Approve candidates before packaging knowledge.');
  const packageRoot=join(root,'.senten','learn','packages',safe(name));await rm(packageRoot,{recursive:true,force:true});await mkdir(join(packageRoot,'payload'),{recursive:true});
  const payload:KnowledgePackPayload={schemaVersion:1,name:safe(name),version,generatedAt:new Date().toISOString(),knowledge:approved.map(({kind,subject,value,confidence,evidence,metadata})=>({kind,subject,value,confidence,evidence,...(metadata?{metadata}:{})}))};
  const content=Buffer.from(JSON.stringify(payload,null,2)+'\n');await writeFile(join(packageRoot,'payload','knowledge.json'),content);const digest=sha256(content);
  const manifest:SentenPackageManifest={senten:1,kind:'knowledge-pack',name:safe(name),version,description:`Evidence-backed Senten knowledge pack: ${name}`,files:['knowledge.json'],integrity:{algorithm:'sha256',files:{'knowledge.json':digest},packageDigest:sha256(Buffer.from(`knowledge.json:${digest}`))},compatibility:{senten:'>=1.0.0-rc.7 <2.0.0',node:'>=22.5.0'},metadata:{knowledgeSchema:1,entries:approved.length,generatedBy:'senten learn package'}};
  await writeFile(join(packageRoot,'senten.package.json'),JSON.stringify(manifest,null,2)+'\n');return{root:packageRoot,manifest,payload};
}

export async function loadKnowledgePack(packageRoot:string):Promise<{manifest:SentenPackageManifest;payload:KnowledgePackPayload}>{const manifest=JSON.parse(await readFile(join(resolve(packageRoot),'senten.package.json'),'utf8')) as SentenPackageManifest;if(manifest.kind!=='knowledge-pack')throw new Error(`Package ${manifest.name} is ${manifest.kind}, not a knowledge-pack.`);const bytes=await readFile(join(resolve(packageRoot),'payload','knowledge.json'));const expected=manifest.integrity?.files?.['knowledge.json'];if(!expected||sha256(bytes)!==expected)throw new Error('Knowledge pack integrity verification failed.');return{manifest,payload:JSON.parse(bytes.toString('utf8')) as KnowledgePackPayload};}

export interface ExternalLearningRecord {
  schemaVersion: 2;
  source: string;
  provider: 'github';
  repository: string;
  ref: string;
  commitSha: string;
  treeSha: string;
  fingerprint: string;
  ingestedAt: string;
  executionPolicy: 'static-only';
  rawSourceRetained: false;
  inventory: LearningInventory;
  selectedFiles: Array<{path:string;sha:string;size:number;kind:'manifest'|'metadata'}>;
  analyzedBytes: number;
  retainedBytes: number;
  knowledge: {frameworkHints:string[];packageNames:string[];dependencyNames:string[]};
  limits: {maxFiles:number;maxRetainedBytes:number;maxSingleFileBytes:number};
}
const SENSITIVE_BASENAMES=new Set(['.env','.env.local','.env.production','.env.development','id_rsa','id_ed25519','credentials','credentials.json','secrets.json']);
const SOURCE_SKIP_PREFIXES=['node_modules/','.git/','.senten/','dist/','build/','.next/','coverage/','vendor/','target/','.dart_tool/','.gradle/'];
function basenamePosix(path:string){return path.split('/').at(-1)??path;}
function safeRemotePath(path:string):boolean{
  const lower=path.toLowerCase();const base=basenamePosix(lower);
  if(SOURCE_SKIP_PREFIXES.some(x=>lower.startsWith(x)||lower.includes('/'+x)))return false;
  if(SENSITIVE_BASENAMES.has(base)||base.startsWith('.env.'))return false;
  if(/\.(pem|key|p12|pfx|jks|keystore|crt|cer|der|sqlite|db|zip|tar|gz|7z|rar|png|jpe?g|gif|webp|mp4|mov|pdf)$/i.test(base))return false;
  return !path.split('/').includes('..');
}
function inventoryRemote(snapshot:RepositorySnapshot):LearningInventory{
  const counts=new Map<string,number>();const manifests:string[]=[];let files=0;
  for(const e of snapshot.entries){if(e.type!=='blob'||!safeRemotePath(e.path))continue;files++;const base=basenamePosix(e.path);if(MANIFESTS.has(base)||base.endsWith('.csproj')||base.endsWith('.fsproj'))manifests.push(e.path);const language=LANGUAGE_BY_EXT[extname(base)];if(language)counts.set(language,(counts.get(language)??0)+1);}
  return{root:`github:${snapshot.repository.owner}/${snapshot.repository.repo}@${snapshot.commitSha}`,files,languages:[...counts].map(([language,n])=>({language,files:n})).sort((a,b)=>b.files-a.files||a.language.localeCompare(b.language)),manifests:manifests.sort()};
}
function externalDir(projectRoot:string,snapshot:RepositorySnapshot):string{return join(projectRoot,'.senten','learn','sources',safe(`${snapshot.repository.owner}-${snapshot.repository.repo}`));}
export async function ingestExternalSource(projectRoot:string,source:string,ref?:string,options:{maxFiles?:number;maxRetainedBytes?:number;maxSingleFileBytes?:number}={}):Promise<{root:string;inventory:LearningInventory;metadataPath:string;record:ExternalLearningRecord}>{
  const provider=new GitHubRepositoryProvider();const snapshot=await provider.snapshot(source,ref);const inventory=inventoryRemote(snapshot);
  const maxFiles=options.maxFiles??64,maxRetainedBytes=options.maxRetainedBytes??2_000_000,maxSingleFileBytes=options.maxSingleFileBytes??256_000;
  const candidates=snapshot.entries.filter(e=>e.type==='blob'&&safeRemotePath(e.path)).filter(e=>{const b=basenamePosix(e.path);return MANIFESTS.has(b)||b==='README.md'||b==='README'||b==='LICENSE'||b==='tsconfig.json'||b==='turbo.json'||b==='pnpm-workspace.yaml'||b==='Dockerfile';}).sort((a,b)=>a.path.localeCompare(b.path));
  const selectedFiles:ExternalLearningRecord['selectedFiles']=[];let analyzedBytes=0;const frameworkHints=new Set<string>();const packageNames=new Set<string>();const dependencyNames=new Set<string>();
  for(const e of candidates){if(selectedFiles.length>=maxFiles)break;if((e.size??0)>maxSingleFileBytes)continue;if(analyzedBytes+(e.size??0)>maxRetainedBytes)break;try{const file=await provider.readText(source,e.path,snapshot.commitSha,{maxBytes:maxSingleFileBytes});selectedFiles.push({path:e.path,sha:file.sha,size:file.size,kind:MANIFESTS.has(basenamePosix(e.path))?'manifest':'metadata'});analyzedBytes+=file.size;if(basenamePosix(e.path)==='package.json'){try{const pkg=JSON.parse(file.content) as {name?:string;dependencies?:Record<string,string>;devDependencies?:Record<string,string>};if(pkg.name)packageNames.add(pkg.name);const deps={...(pkg.dependencies??{}),...(pkg.devDependencies??{})};for(const name of Object.keys(deps))dependencyNames.add(name);if(deps.react)frameworkHints.add('react');if(deps.next)frameworkHints.add('next');if(deps.expo||deps['expo-router'])frameworkHints.add('expo');if(deps.vue)frameworkHints.add('vue');if(deps['@angular/core'])frameworkHints.add('angular');if(deps['@tauri-apps/api']||deps['@tauri-apps/cli'])frameworkHints.add('tauri');if(deps.svelte)frameworkHints.add('svelte');}catch{}}}catch{/* metadata-only ingestion tolerates unreadable optional files */}}
  const root=externalDir(projectRoot,snapshot);await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true});
  let record:ExternalLearningRecord={schemaVersion:2,source,provider:'github',repository:`${snapshot.repository.owner}/${snapshot.repository.repo}`,ref:snapshot.repository.ref??snapshot.defaultBranch,commitSha:snapshot.commitSha,treeSha:snapshot.treeSha,fingerprint:repositoryFingerprint(snapshot),ingestedAt:new Date().toISOString(),executionPolicy:'static-only',rawSourceRetained:false,inventory,selectedFiles,analyzedBytes,retainedBytes:0,knowledge:{frameworkHints:[...frameworkHints].sort(),packageNames:[...packageNames].sort(),dependencyNames:[...dependencyNames].sort()},limits:{maxFiles,maxRetainedBytes,maxSingleFileBytes}};
  const metadataPath=join(root,'senten-knowledge-source.json');let encoded=JSON.stringify(record,null,2)+'\n';record={...record,retainedBytes:Buffer.byteLength(encoded)};encoded=JSON.stringify(record,null,2)+'\n';await writeFile(metadataPath,encoded);return{root,inventory,metadataPath,record};
}
export async function learningStorage(projectRoot:string):Promise<{sources:Array<{name:string;bytes:number;path:string}>;totalBytes:number}>{
  const base=join(projectRoot,'.senten','learn','sources');if(!await exists(base))return{sources:[],totalBytes:0};const out:Array<{name:string;bytes:number;path:string}>=[];for(const entry of await readdir(base,{withFileTypes:true})){if(!entry.isDirectory())continue;const path=join(base,entry.name,'senten-knowledge-source.json');try{const st=await import('node:fs/promises').then(m=>m.stat(path));out.push({name:entry.name,bytes:st.size,path});}catch{}}return{sources:out.sort((a,b)=>a.name.localeCompare(b.name)),totalBytes:out.reduce((n,x)=>n+x.bytes,0)};
}
export async function pruneLearningStorage(projectRoot:string,name?:string):Promise<number>{const base=join(projectRoot,'.senten','learn','sources');if(!await exists(base))return 0;if(name){const target=join(base,safe(name));if(await exists(target)){await rm(target,{recursive:true,force:true});return 1;}return 0;}const entries=await readdir(base,{withFileTypes:true});let count=0;for(const e of entries)if(e.isDirectory()){await rm(join(base,e.name),{recursive:true,force:true});count++;}return count;}

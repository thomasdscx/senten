import * as ts from 'typescript';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, relative, posix } from 'node:path';
import type { ApplicationIR, SemanticEdge, SemanticNode } from '../../core/src/index.js';
import type { ApplicationIRFragment, ExtensionSourceAnalyzer, ExtensionSourceContribution } from '../../extension-sdk/src/index.js';
import { mergeApplicationIRFragments } from '../../semantic/src/index.js';

const PARSER_VERSION = 'senten-source-v1';
const SOURCE_EXTENSIONS = new Set(['.ts','.tsx','.js','.jsx','.mts','.cts','.mjs','.cjs']);
const DEFAULT_IGNORES = new Set(['.git','.senten','node_modules','dist','build','.next','coverage','out','vendor']);

export interface SourceSymbol {
  name: string;
  kind: 'function'|'class'|'interface'|'type'|'variable'|'enum';
  exported: boolean;
  async?: boolean;
  reactComponent?: boolean;
  actionLike?: boolean;
  resourceLike?: boolean;
  providerLike?: boolean;
  line: number;
}
export interface ParsedSourceFile {
  path: string;
  hash: string;
  language: string;
  imports: { specifier: string; names: string[]; typeOnly: boolean }[];
  exports: string[];
  symbols: SourceSymbol[];
  calls: string[];
  frameworkHints: string[];
  route?: { path: string; kind: 'page'|'api'; methods?: string[] };
  test: boolean;
  loc: number;
}
export interface DiscoveryStats { files: number; parsed: number; cacheHits: number; cacheMisses: number; nodes: number; edges: number; durationMs: number; }
export interface DiscoveryResult { ir: ApplicationIR; files: ParsedSourceFile[]; stats: DiscoveryStats; frameworks: string[]; workspacePackages?: WorkspacePackage[]; }
export interface WorkspacePackage { name:string; root:string; }
export interface SemanticDiff { addedNodes: SemanticNode[]; removedNodes: SemanticNode[]; changedNodes: { before: SemanticNode; after: SemanticNode }[]; addedEdges: SemanticEdge[]; removedEdges: SemanticEdge[]; breaking: string[]; }
export interface ArchitectureManifest { schemaVersion:'0.1'; nodes:SemanticNode[]; edges:SemanticEdge[]; metadata?:Record<string,unknown>; }

function hash(data:string|Buffer):string{return createHash('sha256').update(data).digest('hex');}
async function exists(path:string):Promise<boolean>{try{await access(path,constants.F_OK);return true;}catch{return false;}}
function norm(path:string):string{return path.replaceAll('\\','/');}
function idSafe(input:string):string{return input.replace(/[^A-Za-z0-9_.\-/]+/g,'-');}

export async function discoverSourceProject(cwd:string, application:ApplicationIR['application'], existing?:ApplicationIR, options:{force?:boolean; analyzers?:{namespace:string;analyzer:ExtensionSourceAnalyzer}[]}={}):Promise<DiscoveryResult>{
  const started=Date.now(); const cacheRoot=join(cwd,'.senten','cache','source'); await mkdir(join(cacheRoot,'objects'),{recursive:true});
  const workspacePackages=await discoverWorkspacePackages(cwd); const projectFrameworks=await detectProjectFrameworks(cwd); const paths=await collectSourceFiles(cwd,await loadSentenIgnore(cwd)); const files:ParsedSourceFile[]=[]; const extensionNodes:SemanticNode[]=[]; const extensionEdges:SemanticEdge[]=[]; const extensionFragments:ApplicationIRFragment[]=[]; const extensionFrameworks=new Set<string>(); let hits=0,misses=0,parsed=0;
  for(const abs of paths){const content=await readFile(abs,'utf8');const rel=norm(relative(cwd,abs));const digest=hash(`${PARSER_VERSION}\0${content}`);const cachePath=join(cacheRoot,'objects',`${digest}.json`);
    let result:ParsedSourceFile;
    if(!options.force&&await exists(cachePath)){const cached=JSON.parse(await readFile(cachePath,'utf8')) as ParsedSourceFile;result={...cached,path:rel,hash:digest};hits++;}
    else{result=parseSource(rel,content,digest);await writeFile(cachePath,JSON.stringify(result));misses++;parsed++;}
    files.push(result);
    for(const registration of options.analyzers??[]){const rawContribution=await registration.analyzer.analyze({path:rel,content,language:result.language,imports:result.imports.map(i=>i.specifier),exports:result.exports,projectFrameworks});const contribution=scopeContribution(rawContribution,rel,workspacePackages);for(const node of contribution.nodes??[])extensionNodes.push({...node,metadata:{discoveredBy:`extension:${registration.namespace}`,...node.metadata}});for(const edge of contribution.edges??[])extensionEdges.push({...edge,metadata:{discoveredBy:`extension:${registration.namespace}`,...edge.metadata}});if(contribution.fragment)extensionFragments.push({...contribution.fragment,source:{...contribution.fragment.source,adapter:contribution.fragment.source.adapter||registration.namespace,analyzer:contribution.fragment.source.analyzer??registration.analyzer.name,files:[...new Set([...(contribution.fragment.source.files??[]),rel])]}});for(const hint of [...(contribution.frameworkHints??[]),...(contribution.fragment?.frameworkHints??[])])extensionFrameworks.add(hint);}
  }
  const graph=buildGraph(application,files,workspacePackages); graph.nodes.push(...extensionNodes); graph.edges.push(...extensionEdges);
  const manifest=await loadArchitectureManifest(cwd);
  if(manifest){for(const node of manifest.nodes)graph.nodes.push({...node,metadata:{declaredBy:'architecture-manifest',...node.metadata}});for(const edge of manifest.edges)graph.edges.push({...edge,metadata:{declaredBy:'architecture-manifest',...edge.metadata}});}
  graph.nodes=dedupeNodes(graph.nodes); graph.edges=dedupeEdges(graph.edges);
  const retained=(existing?.nodes??[]).filter(n=>n.metadata?.discoveredBy!=='source-intelligence'&&!Array.isArray(n.metadata?.irFragmentProvenance)&&n.kind!=='application');
  const retainedEdges=(existing?.edges??[]).filter(e=>e.metadata?.discoveredBy!=='source-intelligence'&&!Array.isArray(e.metadata?.irFragmentProvenance));
  const applicationNode:SemanticNode={id:`application:${application.id}`,kind:'application',label:application.name,metadata:{source:'senten'}};
  const nodeMap=new Map<string,SemanticNode>([[applicationNode.id,applicationNode],...retained.map(n=>[n.id,n] as const),...graph.nodes.map(n=>[n.id,n] as const)]);
  const edgeMap=new Map<string,SemanticEdge>();for(const e of [...retainedEdges,...graph.edges])edgeMap.set(`${e.from}\0${e.relation}\0${e.to}`,e);
  let ir:ApplicationIR={schemaVersion:'0.1',application,nodes:[...nodeMap.values()],edges:[...edgeMap.values()],generatedAt:new Date().toISOString()}; if(extensionFragments.length){ir=mergeApplicationIRFragments(ir,extensionFragments).ir;}
  const generator=await isTemplateGenerator(cwd); const frameworks=[...new Set(generator?projectFrameworks:[...projectFrameworks,...files.flatMap(f=>f.frameworkHints),...extensionFrameworks])].sort();
  const cacheManifest={parserVersion:PARSER_VERSION,generatedAt:ir.generatedAt,files:files.map(f=>({path:f.path,hash:f.hash})),frameworks};await writeFile(join(cacheRoot,'manifest.json'),JSON.stringify(cacheManifest,null,2)+'\n');
  return{ir,files,frameworks,workspacePackages,stats:{files:files.length,parsed,cacheHits:hits,cacheMisses:misses,nodes:graph.nodes.length,edges:graph.edges.length,durationMs:Date.now()-started}};
}


async function loadArchitectureManifest(root:string):Promise<ArchitectureManifest|undefined>{
  const path=join(root,'senten.architecture.json');
  if(!await exists(path))return undefined;
  const parsed=JSON.parse(await readFile(path,'utf8')) as ArchitectureManifest;
  if(parsed.schemaVersion!=='0.1')throw new Error(`Unsupported senten.architecture.json schema: ${String((parsed as any).schemaVersion)}`);
  if(!Array.isArray(parsed.nodes)||!Array.isArray(parsed.edges))throw new Error('Invalid senten.architecture.json: nodes and edges arrays are required.');
  const ids=new Set(parsed.nodes.map(n=>n.id));
  for(const node of parsed.nodes)if(!node?.id||!node?.kind)throw new Error('Invalid senten.architecture.json: every node requires id and kind.');
  for(const edge of parsed.edges){if(!edge?.from||!edge?.to||!edge?.relation)throw new Error('Invalid senten.architecture.json: every edge requires from, to, relation.');if(!ids.has(edge.from)&&!edge.from.startsWith('application:'))throw new Error(`Architecture manifest edge references undeclared source: ${edge.from}`);if(!ids.has(edge.to)&&!edge.to.startsWith('application:'))throw new Error(`Architecture manifest edge references undeclared target: ${edge.to}`);}
  return parsed;
}


async function detectProjectFrameworks(root:string):Promise<string[]>{
  try{
    const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')) as {name?:string;dependencies?:Record<string,string>;devDependencies?:Record<string,string>};
    const deps={...(pkg.dependencies??{}),...(pkg.devDependencies??{})};const out=new Set<string>();
    const name=(pkg.name??'').toLowerCase();
    if(name.includes('tauri')&&(name.startsWith('create-')||await exists(join(root,'templates'))))out.add('tauri');
    if(deps.react)out.add('react');
    if(deps.next)out.add('next');
    if(deps.expo||deps['expo-router'])out.add('expo');
    if(deps['@tauri-apps/api']||deps['@tauri-apps/cli'])out.add('tauri');
    if(deps.vue)out.add('vue');
    if(deps['@angular/core'])out.add('angular');
    if(deps['@supabase/supabase-js'])out.add('supabase');
    if(await isTemplateGenerator(root)&&out.has('tauri'))return ['tauri'];
    return [...out].sort();
  }catch{return [];}
}

async function loadSentenIgnore(root:string):Promise<string[]>{try{return (await readFile(join(root,'.sentenignore'),'utf8')).split(/\r?\n/).map(x=>norm(x.trim()).replace(/^\.\//,'').replace(/\*\*?$/,'').replace(/\/$/,'')).filter(x=>x&&!x.startsWith('#'));}catch{return [];}}
function ignoredRelative(path:string,ignores:string[]):boolean{const p=norm(path);return ignores.some(prefix=>p===prefix||p.startsWith(prefix+'/'));}
async function collectSourceFiles(root:string,ignorePrefixes:string[]=[]):Promise<string[]>{const out:string[]=[];async function walk(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory()&&DEFAULT_IGNORES.has(entry.name))continue;const p=join(dir,entry.name);const rel=norm(relative(root,p));if(ignoredRelative(rel,ignorePrefixes))continue;if(entry.isDirectory())await walk(p);else if(entry.isFile()&&SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase()))out.push(p);}}await walk(root);return out.sort();}

function parseSource(path:string,content:string,digest:string):ParsedSourceFile{
  const ext=extname(path);const scriptKind=ext==='.tsx'?ts.ScriptKind.TSX:ext==='.jsx'?ts.ScriptKind.JSX:ext==='.js'||ext==='.mjs'||ext==='.cjs'?ts.ScriptKind.JS:ts.ScriptKind.TS;
  const sf=ts.createSourceFile(path,content,ts.ScriptTarget.Latest,true,scriptKind);const imports:ParsedSourceFile['imports']=[];const symbols:SourceSymbol[]=[];const exports:string[]=[];const calls=new Set<string>();const frameworkHints=new Set<string>();const methods=new Set<string>();
  const hasExport=(node:ts.Node)=>Boolean(ts.getCombinedModifierFlags(node as ts.Declaration)&ts.ModifierFlags.Export);
  const addSymbol=(name:string,kind:SourceSymbol['kind'],node:ts.Node,extra:Partial<SourceSymbol>={})=>{const exported=hasExport(node);if(exported)exports.push(name);symbols.push({name,kind,exported,line:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1,...extra});};
  for(const st of sf.statements){
    if(ts.isImportDeclaration(st)&&ts.isStringLiteral(st.moduleSpecifier)){const spec=st.moduleSpecifier.text;const names:string[]=[];const clause=st.importClause;if(clause?.name)names.push(clause.name.text);if(clause?.namedBindings){if(ts.isNamespaceImport(clause.namedBindings))names.push(clause.namedBindings.name.text);else for(const el of clause.namedBindings.elements)names.push(el.name.text);}imports.push({specifier:spec,names,typeOnly:Boolean(clause?.isTypeOnly)});if(spec==='react'||spec.startsWith('react/'))frameworkHints.add('react');if(spec==='next'||spec.startsWith('next/'))frameworkHints.add('next');if(spec.startsWith('vue'))frameworkHints.add('vue');if(spec.startsWith('@angular/'))frameworkHints.add('angular');if(spec.startsWith('@supabase/'))frameworkHints.add('supabase');}
    if(ts.isFunctionDeclaration(st)&&st.name){const n=st.name.text;addSymbol(n,'function',st,{async:Boolean(st.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)),reactComponent:/^[A-Z]/.test(n)&&(ext==='.tsx'||ext==='.jsx'),actionLike:/^(create|update|delete|remove|save|submit|send|handle|execute|run|GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(n) || /^(create|update|delete|remove|save|submit|send|handle|execute|run)[A-Z_]/.test(n)});if(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(n))methods.add(n);}
    if(ts.isClassDeclaration(st)&&st.name){const n=st.name.text;addSymbol(n,'class',st,{providerLike:/(Provider|Adapter|Client|Repository|Service)$/.test(n),resourceLike:/(Entity|Model|Record)$/.test(n)});}
    if(ts.isInterfaceDeclaration(st)){const n=st.name.text;addSymbol(n,'interface',st,{resourceLike:/(Entity|Model|Record|Input|Payload|DTO|Dto)$/.test(n)});}
    if(ts.isTypeAliasDeclaration(st)){const n=st.name.text;addSymbol(n,'type',st,{resourceLike:/(Entity|Model|Record|Input|Payload|DTO|Dto)$/.test(n)});}
    if(ts.isEnumDeclaration(st))addSymbol(st.name.text,'enum',st,{resourceLike:true});
    if(ts.isVariableStatement(st)){for(const d of st.declarationList.declarations)if(ts.isIdentifier(d.name)){const n=d.name.text;const initializer=d.initializer;const isFn=initializer&&(ts.isArrowFunction(initializer)||ts.isFunctionExpression(initializer));addSymbol(n,'variable',st,{reactComponent:Boolean(isFn&&/^[A-Z]/.test(n)&&(ext==='.tsx'||ext==='.jsx')),actionLike:Boolean(isFn&&/^(create|update|delete|remove|save|submit|send|handle|execute|run)/.test(n))});}}
  }
  function visit(node:ts.Node){if(ts.isCallExpression(node)){const e=node.expression;if(ts.isIdentifier(e))calls.add(e.text);else if(ts.isPropertyAccessExpression(e)){const left=e.expression.getText(sf);calls.add(`${left}.${e.name.text}`);}}ts.forEachChild(node,visit);}visit(sf);
  const route=inferRoute(path,[...methods]);const test=/(^|\/)(__tests__\/|.*\.(test|spec)\.[cm]?[jt]sx?$)/.test(path);return{path,hash:digest,language:languageForExt(ext),imports,exports:[...new Set(exports)],symbols,calls:[...calls].sort(),frameworkHints:[...frameworkHints].sort(),...(route?{route}:{}),test,loc:content.split(/\r?\n/).length};
}

function canonicalRoute(raw:string):string{const cleaned=raw.split('/').filter(x=>x&&!x.startsWith('(')&&!x.startsWith('@')).join('/').replace(/\[\.\.\.([^\]]+)\]/g,':$1*').replace(/\[([^\]]+)\]/g,':$1').replace(/\/index$/,'');return cleaned?`/${cleaned.replace(/^\/+/, '')}`:'/';}
function inferRoute(path:string,methods:string[]):ParsedSourceFile['route']|undefined{const p=norm(path);let m=p.match(/(?:^|\/)app\/(.+)\/page\.[cm]?[jt]sx?$/);if(m)return{path:canonicalRoute(m[1]!),kind:'page'};if(/(?:^|\/)app\/page\.[cm]?[jt]sx?$/.test(p))return{path:'/',kind:'page'};m=p.match(/(?:^|\/)pages\/(.+)\.[cm]?[jt]sx?$/);if(m&&!m[1]!.startsWith('_')&&!m[1]!.startsWith('api/'))return{path:canonicalRoute(m[1]!),kind:'page'};m=p.match(/(?:^|\/)app\/(.+)\/route\.[cm]?[jt]s$/);if(m)return{path:canonicalRoute(m[1]!),kind:'api',methods};m=p.match(/(?:^|\/)pages\/api\/(.+)\.[cm]?[jt]s$/);if(m)return{path:canonicalRoute('api/'+m[1]!),kind:'api',methods};return undefined;}
function languageForExt(ext:string):string{return ext.includes('ts')?'typescript':'javascript';}

function buildGraph(application:ApplicationIR['application'],files:ParsedSourceFile[],workspacePackages:WorkspacePackage[]):{nodes:SemanticNode[];edges:SemanticEdge[]}{
  const nodes:SemanticNode[]=[];const edges:SemanticEdge[]=[];const fileMap=new Map(files.map(f=>[f.path,f]));const sourceMeta={discoveredBy:'source-intelligence',discoveryVersion:PARSER_VERSION};const scoped=workspacePackages.some(p=>p.root);const packageByName=new Map(workspacePackages.filter(p=>p.root).map(p=>[p.name,p]));
  const addNode=(n:SemanticNode)=>nodes.push({...n,metadata:{...sourceMeta,...n.metadata}});const addEdge=(e:SemanticEdge)=>edges.push({...e,metadata:{...sourceMeta,...e.metadata}});
  if(scoped)for(const pkg of workspacePackages.filter(p=>p.root)){const mid=`module:${pkg.name}`;addNode({id:mid,kind:'module',label:pkg.name,source:pkg.root,metadata:{workspacePackage:true,workspaceRoot:pkg.root}});addEdge({from:`application:${application.id}`,to:mid,relation:'contains-package'});}
  for(const f of files){const fileId=`file:${f.path}`;const owner=workspacePackageForPath(f.path,workspacePackages);addNode({id:fileId,kind:'file',label:f.path,source:f.path,metadata:{hash:f.hash,language:f.language,loc:f.loc,test:f.test,frameworks:f.frameworkHints,...(owner?.root?{workspacePackage:owner.name,workspaceRoot:owner.root}:{})}});addEdge({from:`application:${application.id}`,to:fileId,relation:'contains'});if(scoped&&owner?.root)addEdge({from:`module:${owner.name}`,to:fileId,relation:'contains'});
    if(f.test){const tid=`test:${idSafe(f.path)}`;addNode({id:tid,kind:'test',label:f.path,source:f.path});addEdge({from:tid,to:fileId,relation:'defined-in'});}
    if(f.route){const rid=semanticScopedId('route',f.route.path,f.path,workspacePackages);addNode({id:rid,kind:'route',label:f.route.path,source:f.path,metadata:{routeKind:f.route.kind,methods:f.route.methods??[],...(owner?.root?{workspacePackage:owner.name,workspaceRoot:owner.root}:{})}});addEdge({from:rid,to:fileId,relation:'implemented-by'});}
    for(const s of f.symbols){let kind:SemanticNode['kind']='symbol';if(s.reactComponent)kind='component';else if(s.actionLike)kind='action';else if(s.providerLike)kind='provider';else if(s.resourceLike)kind='resource';const sid=`${kind}:${idSafe(s.name)}@${f.path}`;addNode({id:sid,kind,label:s.name,source:f.path,metadata:{symbolKind:s.kind,exported:s.exported,line:s.line,async:s.async??false}});addEdge({from:sid,to:fileId,relation:'defined-in'});if(f.route&&kind==='action')addEdge({from:semanticScopedId('route',f.route.path,f.path,workspacePackages),to:sid,relation:'dispatches'});}
  }
  for(const f of files){const from=`file:${f.path}`;for(const imp of f.imports){const target=resolveImport(f.path,imp.specifier,fileMap);if(target)addEdge({from,to:`file:${target}`,relation:imp.typeOnly?'imports-type':'imports',metadata:{specifier:imp.specifier,names:imp.names}});else if(!imp.specifier.startsWith('.')&&!imp.specifier.startsWith('/')){const pkg=packageRoot(imp.specifier);const localPkg=packageByName.get(pkg);if(localPkg){const mid=`module:${localPkg.name}`;if(!nodes.some(n=>n.id===mid))addNode({id:mid,kind:'module',label:localPkg.name,source:localPkg.root,metadata:{workspacePackage:true,workspaceRoot:localPkg.root}});addEdge({from,to:mid,relation:'uses-workspace-package',metadata:{specifier:imp.specifier}});}else{const pid=`provider:package/${pkg}`;if(!nodes.some(n=>n.id===pid))addNode({id:pid,kind:'provider',label:pkg,metadata:{external:true,package:pkg}});addEdge({from,to:pid,relation:'uses-package'});}}}
  }
  return{nodes:dedupeNodes(nodes),edges:dedupeEdges(edges)};
}

function semanticScopedId(kind:string,value:string,source:string,packages:WorkspacePackage[]):string{const owner=workspacePackageForPath(source,packages);return owner?.root?`${kind}:${owner.root}:${value}`:`${kind}:${value}`;}
function workspacePackageForPath(path:string,packages:WorkspacePackage[]):WorkspacePackage|undefined{const p=norm(path);return packages.filter(pkg=>pkg.root&&(p===pkg.root||p.startsWith(pkg.root+'/'))).sort((a,b)=>b.root.length-a.root.length)[0]??packages.find(pkg=>!pkg.root);}
function scopeContribution(contribution:ExtensionSourceContribution,path:string,packages:WorkspacePackage[]):ExtensionSourceContribution{const owner=workspacePackageForPath(path,packages);if(!owner?.root)return contribution;const remap=new Map<string,string>();const scopedKinds=new Set(['route','action','resource','policy','invariant','capability','event','state','feature']);const mapNode=(node:SemanticNode):SemanticNode=>{if(!scopedKinds.has(node.kind)||node.id.includes(`:${owner.root}:`))return{...node,metadata:{...node.metadata,workspacePackage:owner.name,workspaceRoot:owner.root}};const prefix=`${node.kind}:`;const suffix=node.id.startsWith(prefix)?node.id.slice(prefix.length):node.id;const id=`${node.kind}:${owner.root}:${suffix}`;remap.set(node.id,id);return{...node,id,metadata:{...node.metadata,workspacePackage:owner.name,workspaceRoot:owner.root}};};const mapEdge=(edge:SemanticEdge):SemanticEdge=>({...edge,from:remap.get(edge.from)??edge.from,to:remap.get(edge.to)??edge.to});const nodes=(contribution.nodes??[]).map(mapNode);const fragmentNodes=(contribution.fragment?.nodes??[]).map(mapNode);const edges=(contribution.edges??[]).map(mapEdge);const fragmentEdges=(contribution.fragment?.edges??[]).map(mapEdge);return{...contribution,nodes,edges,...(contribution.fragment?{fragment:{...contribution.fragment,nodes:fragmentNodes,edges:fragmentEdges}}:{})};}
async function discoverWorkspacePackages(root:string):Promise<WorkspacePackage[]>{const out:WorkspacePackage[]=[];async function walk(dir:string){const rel=norm(relative(root,dir));const pkgPath=join(dir,'package.json');if(await exists(pkgPath)){try{const pkg=JSON.parse(await readFile(pkgPath,'utf8')) as {name?:string};out.push({name:pkg.name||rel||'.',root:rel});}catch{}}for(const entry of await readdir(dir,{withFileTypes:true})){if(!entry.isDirectory()||DEFAULT_IGNORES.has(entry.name))continue;await walk(join(dir,entry.name));}}await walk(root);const unique=new Map(out.map(pkg=>[pkg.root,pkg]));return [...unique.values()].sort((a,b)=>a.root.localeCompare(b.root));}
async function isTemplateGenerator(root:string):Promise<boolean>{try{const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')) as {name?:string};const name=(pkg.name??'').toLowerCase();return (name.startsWith('create-')||name.endsWith('-generator')||name.includes('scaffold'))&&await exists(join(root,'templates'));}catch{return false;}}
function packageRoot(spec:string):string{if(spec.startsWith('@'))return spec.split('/').slice(0,2).join('/');return spec.split('/')[0]!;}
function importCandidates(base:string):string[]{const clean=base.replace(/^\.\//,'').replace(/^\//,'');return[clean,...['.ts','.tsx','.js','.jsx','.mts','.cts','.mjs','.cjs'].map(x=>clean+x),...['index.ts','index.tsx','index.js','index.jsx'].map(x=>`${clean}/${x}`)];}
function resolveImport(from:string,spec:string,files:Map<string,ParsedSourceFile>):string|undefined{const normalizedFrom=norm(from);if(spec.startsWith('.')){const base=posix.normalize(posix.join(posix.dirname(normalizedFrom),spec));return importCandidates(base).find(c=>files.has(c));}if(spec.startsWith('/'))return undefined;const aliasBase=spec.startsWith('@/')||spec.startsWith('~/')?spec.slice(2):spec;const top=aliasBase.split('/')[0];const localRoots=new Set([...files.keys()].map(x=>x.split('/')[0]));if((spec.startsWith('@/')||spec.startsWith('~/')||localRoots.has(top))){const found=importCandidates(aliasBase).find(c=>files.has(c));if(found)return found;}return undefined;}
function dedupeNodes(nodes:SemanticNode[]):SemanticNode[]{const m=new Map<string,SemanticNode>();for(const n of nodes){const prev=m.get(n.id);m.set(n.id,prev?{...prev,...n,metadata:{...prev.metadata,...n.metadata}}:n);}return[...m.values()];}
function dedupeEdges(edges:SemanticEdge[]):SemanticEdge[]{const m=new Map<string,SemanticEdge>();for(const e of edges)m.set(`${e.from}\0${e.relation}\0${e.to}`,e);return[...m.values()];}

export function diffIR(before:ApplicationIR,after:ApplicationIR):SemanticDiff{const bn=new Map(before.nodes.map(n=>[n.id,n]));const an=new Map(after.nodes.map(n=>[n.id,n]));const addedNodes=[...an.values()].filter(n=>!bn.has(n.id));const removedNodes=[...bn.values()].filter(n=>!an.has(n.id));const changedNodes:[SemanticNode,SemanticNode][]=[];for(const [id,a] of an){const b=bn.get(id);if(b&&stableNode(b)!==stableNode(a))changedNodes.push([b,a]);}const edgeKey=(e:SemanticEdge)=>`${e.from}\0${e.relation}\0${e.to}`;const be=new Map(before.edges.map(e=>[edgeKey(e),e]));const ae=new Map(after.edges.map(e=>[edgeKey(e),e]));const addedEdges=[...ae.entries()].filter(([k])=>!be.has(k)).map(([,e])=>e);const removedEdges=[...be.entries()].filter(([k])=>!ae.has(k)).map(([,e])=>e);const breaking:string[]=[];for(const n of removedNodes)if(['action','route','policy','invariant','resource'].includes(n.kind))breaking.push(`Removed ${n.kind} ${n.label??n.id}`);for(const e of removedEdges)if(['requires','preserves','dispatches'].includes(e.relation))breaking.push(`Removed relationship ${e.from} -(${e.relation})-> ${e.to}`);return{addedNodes,removedNodes,changedNodes:changedNodes.map(([before,after])=>({before,after})),addedEdges,removedEdges,breaking};}
function stableNode(n:SemanticNode):string{return JSON.stringify(sortObject({kind:n.kind,label:n.label,source:n.source,metadata:n.metadata}));}
function sortObject(value:unknown):unknown{if(Array.isArray(value))return value.map(sortObject);if(value&&typeof value==='object'){const out:Record<string,unknown>={};for(const key of Object.keys(value as Record<string,unknown>).sort())out[key]=sortObject((value as Record<string,unknown>)[key]);return out;}return value;}

export function summarizeDiff(d:SemanticDiff){return{addedNodes:d.addedNodes.length,removedNodes:d.removedNodes.length,changedNodes:d.changedNodes.length,addedEdges:d.addedEdges.length,removedEdges:d.removedEdges.length,breaking:d.breaking.length};}

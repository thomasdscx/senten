import * as ts from 'typescript';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, relative, posix } from 'node:path';
import type { ApplicationIR, SemanticEdge, SemanticNode } from '../../core/src/index.js';
import type { ExtensionSourceAnalyzer } from '../../extension-sdk/src/index.js';

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
export interface DiscoveryResult { ir: ApplicationIR; files: ParsedSourceFile[]; stats: DiscoveryStats; frameworks: string[]; }
export interface SemanticDiff { addedNodes: SemanticNode[]; removedNodes: SemanticNode[]; changedNodes: { before: SemanticNode; after: SemanticNode }[]; addedEdges: SemanticEdge[]; removedEdges: SemanticEdge[]; breaking: string[]; }

function hash(data:string|Buffer):string{return createHash('sha256').update(data).digest('hex');}
async function exists(path:string):Promise<boolean>{try{await access(path,constants.F_OK);return true;}catch{return false;}}
function norm(path:string):string{return path.replaceAll('\\','/');}
function idSafe(input:string):string{return input.replace(/[^A-Za-z0-9_.\-/]+/g,'-');}

export async function discoverSourceProject(cwd:string, application:ApplicationIR['application'], existing?:ApplicationIR, options:{force?:boolean; analyzers?:{namespace:string;analyzer:ExtensionSourceAnalyzer}[]}={}):Promise<DiscoveryResult>{
  const started=Date.now(); const cacheRoot=join(cwd,'.senten','cache','source'); await mkdir(join(cacheRoot,'objects'),{recursive:true});
  const paths=await collectSourceFiles(cwd); const files:ParsedSourceFile[]=[]; const extensionNodes:SemanticNode[]=[]; const extensionEdges:SemanticEdge[]=[]; const extensionFrameworks=new Set<string>(); let hits=0,misses=0,parsed=0;
  for(const abs of paths){const content=await readFile(abs,'utf8');const rel=norm(relative(cwd,abs));const digest=hash(`${PARSER_VERSION}\0${content}`);const cachePath=join(cacheRoot,'objects',`${digest}.json`);
    let result:ParsedSourceFile;
    if(!options.force&&await exists(cachePath)){const cached=JSON.parse(await readFile(cachePath,'utf8')) as ParsedSourceFile;result={...cached,path:rel,hash:digest};hits++;}
    else{result=parseSource(rel,content,digest);await writeFile(cachePath,JSON.stringify(result));misses++;parsed++;}
    files.push(result);
    for(const registration of options.analyzers??[]){const contribution=await registration.analyzer.analyze({path:rel,content,language:result.language,imports:result.imports.map(i=>i.specifier),exports:result.exports});for(const node of contribution.nodes??[])extensionNodes.push({...node,metadata:{discoveredBy:`extension:${registration.namespace}`,...node.metadata}});for(const edge of contribution.edges??[])extensionEdges.push({...edge,metadata:{discoveredBy:`extension:${registration.namespace}`,...edge.metadata}});for(const hint of contribution.frameworkHints??[])extensionFrameworks.add(hint);}
  }
  const graph=buildGraph(application,files); graph.nodes.push(...extensionNodes); graph.edges.push(...extensionEdges); graph.nodes=dedupeNodes(graph.nodes); graph.edges=dedupeEdges(graph.edges);
  const retained=(existing?.nodes??[]).filter(n=>n.metadata?.discoveredBy!=='source-intelligence'&&n.kind!=='application');
  const retainedEdges=(existing?.edges??[]).filter(e=>e.metadata?.discoveredBy!=='source-intelligence');
  const applicationNode:SemanticNode={id:`application:${application.id}`,kind:'application',label:application.name,metadata:{source:'senten'}};
  const nodeMap=new Map<string,SemanticNode>([[applicationNode.id,applicationNode],...retained.map(n=>[n.id,n] as const),...graph.nodes.map(n=>[n.id,n] as const)]);
  const edgeMap=new Map<string,SemanticEdge>();for(const e of [...retainedEdges,...graph.edges])edgeMap.set(`${e.from}\0${e.relation}\0${e.to}`,e);
  const ir:ApplicationIR={schemaVersion:'0.1',application,nodes:[...nodeMap.values()],edges:[...edgeMap.values()],generatedAt:new Date().toISOString()};
  const frameworks=[...new Set([...files.flatMap(f=>f.frameworkHints),...extensionFrameworks])].sort();
  const manifest={parserVersion:PARSER_VERSION,generatedAt:ir.generatedAt,files:files.map(f=>({path:f.path,hash:f.hash})),frameworks};await writeFile(join(cacheRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return{ir,files,frameworks,stats:{files:files.length,parsed,cacheHits:hits,cacheMisses:misses,nodes:graph.nodes.length,edges:graph.edges.length,durationMs:Date.now()-started}};
}

async function collectSourceFiles(root:string):Promise<string[]>{const out:string[]=[];async function walk(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory()&&DEFAULT_IGNORES.has(entry.name))continue;const p=join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(entry.isFile()&&SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase()))out.push(p);}}await walk(root);return out.sort();}

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

function inferRoute(path:string,methods:string[]):ParsedSourceFile['route']|undefined{const p=norm(path);let m=p.match(/(?:^|\/)app\/(.+)\/page\.[cm]?[jt]sx?$/);if(m){let route='/' + m[1]!.split('/').filter(x=>!x.startsWith('(')).join('/');route=route.replace(/\/index$/,'/');return{path:route==='/'?'/':route,kind:'page'};}if(/(?:^|\/)app\/page\.[cm]?[jt]sx?$/.test(p))return{path:'/',kind:'page'};m=p.match(/(?:^|\/)pages\/(.+)\.[cm]?[jt]sx?$/);if(m&&!m[1]!.startsWith('_')&&!m[1]!.startsWith('api/')){const route='/' + m[1]!.replace(/\/index$/,'');return{path:route||'/',kind:'page'};}m=p.match(/(?:^|\/)app\/(.+)\/route\.[cm]?[jt]s$/);if(m)return{path:'/'+m[1]!.split('/').filter(x=>!x.startsWith('(')).join('/'),kind:'api',methods};m=p.match(/(?:^|\/)pages\/api\/(.+)\.[cm]?[jt]s$/);if(m)return{path:'/api/'+m[1]!,kind:'api',methods};return undefined;}
function languageForExt(ext:string):string{return ext.includes('ts')?'typescript':'javascript';}

function buildGraph(application:ApplicationIR['application'],files:ParsedSourceFile[]):{nodes:SemanticNode[];edges:SemanticEdge[]}{
  const nodes:SemanticNode[]=[];const edges:SemanticEdge[]=[];const fileMap=new Map(files.map(f=>[f.path,f]));const sourceMeta={discoveredBy:'source-intelligence',discoveryVersion:PARSER_VERSION};
  const addNode=(n:SemanticNode)=>nodes.push({...n,metadata:{...sourceMeta,...n.metadata}});const addEdge=(e:SemanticEdge)=>edges.push({...e,metadata:{...sourceMeta,...e.metadata}});
  for(const f of files){const fileId=`file:${f.path}`;addNode({id:fileId,kind:'file',label:f.path,source:f.path,metadata:{hash:f.hash,language:f.language,loc:f.loc,test:f.test,frameworks:f.frameworkHints}});addEdge({from:`application:${application.id}`,to:fileId,relation:'contains'});
    if(f.test){const tid=`test:${idSafe(f.path)}`;addNode({id:tid,kind:'test',label:f.path,source:f.path});addEdge({from:tid,to:fileId,relation:'defined-in'});}
    if(f.route){const rid=`route:${f.route.path}`;addNode({id:rid,kind:'route',label:f.route.path,source:f.path,metadata:{routeKind:f.route.kind,methods:f.route.methods??[]}});addEdge({from:rid,to:fileId,relation:'implemented-by'});}
    for(const s of f.symbols){let kind:SemanticNode['kind']='symbol';if(s.reactComponent)kind='component';else if(s.actionLike)kind='action';else if(s.providerLike)kind='provider';else if(s.resourceLike)kind='resource';const sid=`${kind}:${idSafe(s.name)}@${f.path}`;addNode({id:sid,kind,label:s.name,source:f.path,metadata:{symbolKind:s.kind,exported:s.exported,line:s.line,async:s.async??false}});addEdge({from:sid,to:fileId,relation:'defined-in'});if(f.route&&kind==='action')addEdge({from:`route:${f.route.path}`,to:sid,relation:'dispatches'});}
  }
  for(const f of files){const from=`file:${f.path}`;for(const imp of f.imports){const target=resolveImport(f.path,imp.specifier,fileMap);if(target)addEdge({from,to:`file:${target}`,relation:imp.typeOnly?'imports-type':'imports',metadata:{specifier:imp.specifier,names:imp.names}});else if(!imp.specifier.startsWith('.')&&!imp.specifier.startsWith('/')){const pkg=packageRoot(imp.specifier);const pid=`provider:package/${pkg}`;if(!nodes.some(n=>n.id===pid))addNode({id:pid,kind:'provider',label:pkg,metadata:{external:true,package:pkg}});addEdge({from,to:pid,relation:'uses-package'});}}
  }
  return{nodes:dedupeNodes(nodes),edges:dedupeEdges(edges)};
}
function packageRoot(spec:string):string{if(spec.startsWith('@'))return spec.split('/').slice(0,2).join('/');return spec.split('/')[0]!;}
function resolveImport(from:string,spec:string,files:Map<string,ParsedSourceFile>):string|undefined{if(!spec.startsWith('.'))return undefined;const normalizedFrom=norm(from);const base=posix.normalize(posix.join(posix.dirname(normalizedFrom),spec)).replace(/^\.\//,'');const candidates=[base,...['.ts','.tsx','.js','.jsx','.mts','.cts','.mjs','.cjs'].map(x=>base+x),...['index.ts','index.tsx','index.js','index.jsx'].map(x=>`${base}/${x}`)];return candidates.find(c=>files.has(c));}
function dedupeNodes(nodes:SemanticNode[]):SemanticNode[]{const m=new Map<string,SemanticNode>();for(const n of nodes){const prev=m.get(n.id);m.set(n.id,prev?{...prev,...n,metadata:{...prev.metadata,...n.metadata}}:n);}return[...m.values()];}
function dedupeEdges(edges:SemanticEdge[]):SemanticEdge[]{const m=new Map<string,SemanticEdge>();for(const e of edges)m.set(`${e.from}\0${e.relation}\0${e.to}`,e);return[...m.values()];}

export function diffIR(before:ApplicationIR,after:ApplicationIR):SemanticDiff{const bn=new Map(before.nodes.map(n=>[n.id,n]));const an=new Map(after.nodes.map(n=>[n.id,n]));const addedNodes=[...an.values()].filter(n=>!bn.has(n.id));const removedNodes=[...bn.values()].filter(n=>!an.has(n.id));const changedNodes:[SemanticNode,SemanticNode][]=[];for(const [id,a] of an){const b=bn.get(id);if(b&&stableNode(b)!==stableNode(a))changedNodes.push([b,a]);}const edgeKey=(e:SemanticEdge)=>`${e.from}\0${e.relation}\0${e.to}`;const be=new Map(before.edges.map(e=>[edgeKey(e),e]));const ae=new Map(after.edges.map(e=>[edgeKey(e),e]));const addedEdges=[...ae.entries()].filter(([k])=>!be.has(k)).map(([,e])=>e);const removedEdges=[...be.entries()].filter(([k])=>!ae.has(k)).map(([,e])=>e);const breaking:string[]=[];for(const n of removedNodes)if(['action','route','policy','invariant','resource'].includes(n.kind))breaking.push(`Removed ${n.kind} ${n.label??n.id}`);for(const e of removedEdges)if(['requires','preserves','dispatches'].includes(e.relation))breaking.push(`Removed relationship ${e.from} -(${e.relation})-> ${e.to}`);return{addedNodes,removedNodes,changedNodes:changedNodes.map(([before,after])=>({before,after})),addedEdges,removedEdges,breaking};}
function stableNode(n:SemanticNode):string{return JSON.stringify(sortObject({kind:n.kind,label:n.label,source:n.source,metadata:n.metadata}));}
function sortObject(value:unknown):unknown{if(Array.isArray(value))return value.map(sortObject);if(value&&typeof value==='object'){const out:Record<string,unknown>={};for(const key of Object.keys(value as Record<string,unknown>).sort())out[key]=sortObject((value as Record<string,unknown>)[key]);return out;}return value;}

export function summarizeDiff(d:SemanticDiff){return{addedNodes:d.addedNodes.length,removedNodes:d.removedNodes.length,changedNodes:d.changedNodes.length,addedEdges:d.addedEdges.length,removedEdges:d.removedEdges.length,breaking:d.breaking.length};}

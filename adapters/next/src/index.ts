import { defineApplicationIRFragment, defineSentenExtension } from '../../../packages/extension-sdk/src/index.js';

function routeFromPath(path:string):string|undefined{
  const p=path.replaceAll('\\','/');
  let m=p.match(/(?:^|\/)app(?:\/(.*?))?\/(page|route)\.[cm]?[jt]sx?$/);if(m){const raw=(m[1]??'').replace(/\/(\([^/]+\)|@[^/]+)(?=\/|$)/g,'').replace(/\[\.\.\.([^\]]+)\]/g,':$1*').replace(/\[([^\]]+)\]/g,':$1');return raw?`/${raw}`:'/';}
  m=p.match(/(?:^|\/)pages\/(.+?)\.[cm]?[jt]sx?$/);if(m){const raw=m[1]!.replace(/\/index$/,'').replace(/^index$/,'').replace(/\[\.\.\.([^\]]+)\]/g,':$1*').replace(/\[([^\]]+)\]/g,':$1');return raw?`/${raw}`:'/';}
  return undefined;
}
export const nextAdapter=defineSentenExtension({
  name:'Senten Next.js Adapter',namespace:'next',version:'1.0.0-rc.3',kind:'adapter',senten:'>=0.21.0-alpha.0',capabilities:['source.read','semantic.write'],
  semanticTypes:['route','ui','action'],detectors:['next.app-router','next.pages-router','next.route-handlers'],hooks:['onDiscover','onSemanticGraph'],
  sourceAnalyzers:[{name:'next.source',analyze({path,content,imports,projectFrameworks}){const route=routeFromPath(path);const isNext=projectFrameworks.includes('next')||imports.some(spec=>spec==='next'||spec.startsWith('next/'));if(!isNext)return{};const nodes=[];const edges=[];if(route){const id=`route:${route}`;nodes.push({id,kind:'route' as const,label:route,source:path,metadata:{framework:'next'}});edges.push({from:`file:${path}`,to:id,relation:'implements-route'});const methods=[...new Set([...content.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map(m=>m[1]!).filter(Boolean))];for(const method of methods){const actionId=`action:http/${method}:${route}`;nodes.push({id:actionId,kind:'action' as const,label:`${method} ${route}`,source:path,metadata:{framework:'next',httpMethod:method}});edges.push({from:id,to:actionId,relation:'dispatches'});edges.push({from:`file:${path}`,to:actionId,relation:'implements-action'});}}const fragment=defineApplicationIRFragment({schemaVersion:'0.1',nodes,edges,frameworkHints:['next'],source:{adapter:'next',adapterVersion:'1.0.0-rc.3',analyzer:'next.source',files:[path],confidence:'high'}});return{fragment};}}],
  commands:[{path:'inspect',description:'Inspect Next.js adapter capabilities.',run(){console.log('Next.js adapter active: App Router, Pages Router, route semantics.');}}]
});

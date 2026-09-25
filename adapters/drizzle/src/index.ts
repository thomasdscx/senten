import { defineApplicationIRFragment, defineSentenExtension } from '../../../packages/extension-sdk/src/index.js';

function tableDeclarations(content:string):Array<{symbol:string;table:string}> {
  const out:Array<{symbol:string;table:string}>=[];
  const rx=/\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:pgTable|mysqlTable|sqliteTable|singlestoreTable)\s*\(\s*['"]([^'"]+)['"]/g;
  for(const m of content.matchAll(rx))out.push({symbol:m[1]!,table:m[2]!});
  return out;
}

export const drizzleAdapter=defineSentenExtension({
  name:'Senten Drizzle Adapter',namespace:'drizzle',version:'1.0.0-rc.6',kind:'adapter',senten:'>=1.0.0-rc.1',
  capabilities:['source.read','semantic.write'],semanticTypes:['provider','resource','action'],detectors:['drizzle.orm','drizzle.tables','drizzle.queries'],hooks:['onDiscover','onSemanticGraph'],
  sourceAnalyzers:[{name:'drizzle.source',analyze({path,content,imports}){
    const isDrizzle=imports.some(spec=>spec==='drizzle-orm'||spec.startsWith('drizzle-orm/'));if(!isDrizzle)return{};
    const providerId='provider:drizzle';const nodes:any[]=[{id:providerId,kind:'provider',label:'Drizzle ORM',source:path,metadata:{provider:'drizzle'}}];const edges:any[]=[];
    const tables=tableDeclarations(content);
    for(const {symbol,table} of tables){const id=`resource:${table}`;nodes.push({id,kind:'resource',label:table,source:path,metadata:{provider:'drizzle',resourceType:'table',symbol}});edges.push({from:providerId,to:id,relation:'provides'});}
    const actionNames=[...new Set([...content.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/g)].map(m=>m[1]!).filter(Boolean))];
    for(const {symbol,table} of tables){const rid=`resource:${table}`;const escaped=symbol.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');for(const action of actionNames){const fnRx=new RegExp(`export\\s+(?:async\\s+)?function\\s+${action}\\b[\\s\\S]*?(?=export\\s+(?:async\\s+)?function\\s+|$)`);const body=content.match(fnRx)?.[0]??'';if(!body)continue;const touches=new RegExp(`(?:from|insert|update|delete)\\s*\\(\\s*${escaped}\\s*\\)`).test(body);if(!touches)continue;const actionId=`action:${action}@${path}`;if(!nodes.some(n=>n.id===actionId))nodes.push({id:actionId,kind:'action',label:action,source:path,metadata:{provider:'drizzle',inferredBy:'drizzle.source'}});const relation=new RegExp(`(?:insert|update|delete)\\s*\\(\\s*${escaped}\\s*\\)`).test(body)?'writes':'reads';edges.push({from:actionId,to:rid,relation,metadata:{confidence:'high',inferredBy:'drizzle.source'}});}}
    return{fragment:defineApplicationIRFragment({schemaVersion:'0.1',nodes,edges,frameworkHints:[],source:{adapter:'drizzle',adapterVersion:'1.0.0-rc.6',analyzer:'drizzle.source',files:[path],confidence:'high'}})};
  }}],
  commands:[{path:'inspect',description:'Inspect Drizzle ORM resource semantics.',run(){console.log('Drizzle adapter active: schema/table and query relationship discovery.');}}]
});

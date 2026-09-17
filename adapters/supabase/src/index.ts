import { defineApplicationIRFragment, defineSentenExtension } from '../../../packages/extension-sdk/src/index.js';

export const supabaseAdapter=defineSentenExtension({
  name:'Senten Supabase Adapter',namespace:'supabase',version:'1.0.0-rc.3',kind:'adapter',senten:'>=0.21.0-alpha.0',
  capabilities:['source.read','semantic.write'],semanticTypes:['provider','resource','action','policy'],detectors:['supabase.client','supabase.tables','supabase.auth','supabase.storage'],hooks:['onDiscover','onSemanticGraph'],
  sourceAnalyzers:[{name:'supabase.source',analyze({path,content,imports,projectFrameworks}){
    const isSupabase=projectFrameworks.includes('supabase')||imports.some(spec=>spec==='@supabase/supabase-js'||spec.startsWith('@supabase/'));if(!isSupabase)return{};
    const nodes=[];const edges=[];const providerId='provider:supabase';
    nodes.push({id:providerId,kind:'provider' as const,label:'Supabase',source:path,metadata:{provider:'supabase'}});
    const tables=[...new Set([...content.matchAll(/\.from\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m=>m[1]!).filter(Boolean))];
    const actions=[...new Set([...content.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/g)].map(m=>m[1]!).filter(Boolean))];
    const relation=/\.(?:insert|update|delete|upsert)\s*\(/.test(content)?'writes':'reads';
    for(const table of tables){const id=`resource:${table}`;nodes.push({id,kind:'resource' as const,label:table,source:path,metadata:{provider:'supabase',resourceType:'table'}});edges.push({from:providerId,to:id,relation:'provides'});for(const action of actions)edges.push({from:`action:${action}@${path}`,to:id,relation,metadata:{confidence:'medium',inferredBy:'supabase.source'}});}
    if(/\.auth\.(?:getUser|getSession|signIn|signOut|signUp)/.test(content)){const id='capability:auth';nodes.push({id,kind:'capability' as const,label:'Authentication',source:path,metadata:{provider:'supabase'}});edges.push({from:providerId,to:id,relation:'provides'});}
    if(/\.storage\./.test(content)){const id='capability:storage';nodes.push({id,kind:'capability' as const,label:'Storage',source:path,metadata:{provider:'supabase'}});edges.push({from:providerId,to:id,relation:'provides'});}
    return{fragment:defineApplicationIRFragment({schemaVersion:'0.1',nodes,edges,frameworkHints:['supabase'],source:{adapter:'supabase',adapterVersion:'1.0.0-rc.3',analyzer:'supabase.source',files:[path],confidence:'high'}})};
  }}],
  commands:[{path:'inspect',description:'Inspect Supabase provider/resource semantics.',run(){console.log('Supabase adapter active: client, tables, auth and storage discovery.');}}]
});

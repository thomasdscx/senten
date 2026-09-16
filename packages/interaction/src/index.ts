import { createHash, randomUUID } from 'node:crypto';
import type { ApplicationIR, InteractionFinding, InteractionRunRecord, InteractionEdgeRecord, InteractionNodeRecord, JourneyDefinition, JourneyStep, JourneyStepResult } from '../../core/src/index.js';

export interface CrawlOptions {
  maxPages?: number;
  sameOrigin?: boolean;
  timeoutMs?: number;
  userAgent?: string;
}

export interface CrawlResult {
  run: InteractionRunRecord;
  nodes: InteractionNodeRecord[];
  edges: InteractionEdgeRecord[];
  findings: InteractionFinding[];
}

export interface ClickthruOptions extends CrawlOptions {
  browser?: 'chromium'|'firefox'|'webkit';
  headless?: boolean;
  maxInteractionsPerPage?: number;
  includeActions?: boolean;
}

export interface JourneyRunOptions {
  browser?: 'chromium'|'firefox'|'webkit';
  headless?: boolean;
  baseUrl?: string;
  inputs?: Record<string,string>;
}

function normalizeUrl(value:string, base?:string):string|undefined {
  try {
    const u = base ? new URL(value, base) : new URL(value);
    if (!['http:','https:'].includes(u.protocol)) return undefined;
    u.hash = '';
    return u.toString();
  } catch { return undefined; }
}

function titleFromHtml(html:string):string|undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.replace(/\s+/g,' ').trim();
}

export function extractHtmlInteractions(html:string, pageUrl:string): { links:{href:string;text?:string}[]; actions:{kind:'button'|'form'|'input'; label?:string; target?:string}[] } {
  const links:{href:string;text?:string}[]=[];
  const actions:{kind:'button'|'form'|'input'; label?:string; target?:string}[]=[];
  const anchorRe=/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const href=normalizeUrl(m[1]!,pageUrl); if(!href)continue;
    const text=(m[2]??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); links.push({href,...(text?{text}:{})});
  }
  const buttonRe=/<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  for (const m of html.matchAll(buttonRe)) { const text=(m[2]??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); actions.push({kind:'button',...(text?{label:text}:{})}); }
  const formRe=/<form\b([^>]*)>/gi;
  for (const m of html.matchAll(formRe)) { const action=(m[1]??'').match(/action\s*=\s*["']([^"']+)["']/i)?.[1]; actions.push({kind:'form',...(action?{target:normalizeUrl(action,pageUrl)??action}:{})}); }
  const inputRe=/<input\b([^>]*)>/gi;
  for (const m of html.matchAll(inputRe)) { const attrs=m[1]??''; const type=attrs.match(/type\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase(); if(type==='hidden')continue; const name=attrs.match(/(?:name|aria-label|placeholder)\s*=\s*["']([^"']+)["']/i)?.[1]; actions.push({kind:'input',...(name?{label:name}:{})}); }
  return {links,actions};
}

export async function crawlWebsite(startUrl:string, options:CrawlOptions={}):Promise<CrawlResult>{
  const normalized=normalizeUrl(startUrl); if(!normalized)throw new Error(`Invalid URL: ${startUrl}`);
  const startedAt=new Date().toISOString(); const runId=`int_${randomUUID().slice(0,8)}`; const maxPages=Math.max(1,options.maxPages??50); const origin=new URL(normalized).origin;
  const queue=[normalized]; const visited=new Set<string>(); const nodes:InteractionNodeRecord[]=[]; const edges:InteractionEdgeRecord[]=[]; const findings:InteractionFinding[]=[];
  while(queue.length&&visited.size<maxPages){
    const url=queue.shift()!; if(visited.has(url))continue; visited.add(url);
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),options.timeoutMs??10000);
    let status=0, html='', contentType='';
    try{
      const response=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':options.userAgent??'Senten Interaction Assurance/0.4'}}); status=response.status; contentType=response.headers.get('content-type')??''; if(contentType.includes('text/html'))html=await response.text();
    }catch(error){ findings.push({id:`finding_${randomUUID().slice(0,8)}`,runId,severity:'error',kind:'request-failed',url,message:error instanceof Error?error.message:String(error)}); }
    finally{clearTimeout(timer);}
    const nodeId=`page:${url}`; { const title=html?titleFromHtml(html):undefined; nodes.push({id:nodeId,runId,url,status,kind:'page',...(title?{title}:{})}); }
    if(status>=400)findings.push({id:`finding_${randomUUID().slice(0,8)}`,runId,severity:'error',kind:'broken-page',url,message:`HTTP ${status}`});
    if(!html)continue;
    const discovered=extractHtmlInteractions(html,url);
    for(const link of discovered.links){
      edges.push({id:`edge_${hashShort(`${url}->${link.href}`)}`,runId,from:`page:${url}`,to:`page:${link.href}`,kind:'link',...(link.text?{label:link.text}:{})});
      const target=new URL(link.href); if((options.sameOrigin??true)&&target.origin!==origin)continue; if(!visited.has(link.href)&&queue.length+visited.size<maxPages*3)queue.push(link.href);
    }
    for(const action of discovered.actions){ const aid=`interaction:${hashShort(`${url}:${action.kind}:${action.label??action.target??''}`)}`; nodes.push({id:aid,runId,url,kind:action.kind,...(action.label?{label:action.label}:{}),...(action.target?{metadata:{target:action.target}}:{})}); edges.push({id:`edge_${hashShort(`${url}->${aid}`)}`,runId,from:`page:${url}`,to:aid,kind:'contains'}); }
  }
  const endedAt=new Date().toISOString(); const run:InteractionRunRecord={id:runId,kind:'crawl',target:normalized,engine:'http',startedAt,endedAt,status:findings.some(f=>f.severity==='error')?'failed':'passed',pages:nodes.filter(n=>n.kind==='page').length,interactions:nodes.filter(n=>n.kind!=='page').length,findings:findings.length,metadata:{maxPages,sameOrigin:options.sameOrigin??true}};
  return {run,nodes,edges,findings};
}

export async function clickthruWebsite(startUrl:string, options:ClickthruOptions={}):Promise<CrawlResult>{
  const normalized=normalizeUrl(startUrl); if(!normalized)throw new Error(`Invalid URL: ${startUrl}`);
  const playwright=await loadPlaywright(); const browserName=options.browser??'chromium'; const browserType=playwright[browserName]; if(!browserType)throw new Error(`Browser engine not available: ${browserName}`);
  let browser:any;
  try{browser=await browserType.launch({headless:options.headless??true});}
  catch(error){throw new Error(`Unable to launch ${browserName}. Install its browser runtime first (for example: npx playwright install ${browserName}). ${error instanceof Error?error.message:String(error)}`);}
  const context=await browser.newContext(); const page=await context.newPage(); const startedAt=new Date().toISOString(); const runId=`int_${randomUUID().slice(0,8)}`; const origin=new URL(normalized).origin; const queue=[normalized]; const visited=new Set<string>(); const nodes:InteractionNodeRecord[]=[]; const edges:InteractionEdgeRecord[]=[]; const findings:InteractionFinding[]=[]; const maxPages=Math.max(1,options.maxPages??20); const maxInteractions=Math.max(1,options.maxInteractionsPerPage??100);
  try{
    while(queue.length&&visited.size<maxPages){
      const url=queue.shift()!; if(visited.has(url))continue; visited.add(url);
      let response:any;
      try{response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:options.timeoutMs??15000});}
      catch(error){findings.push({id:`finding_${randomUUID().slice(0,8)}`,runId,severity:'error',kind:'navigation-failed',url,message:error instanceof Error?error.message:String(error)});continue;}
      const status=response?.status?.()??0; const title=await page.title().catch(()=>undefined); nodes.push({id:`page:${url}`,runId,url,status,title,kind:'page'}); if(status>=400)findings.push({id:`finding_${randomUUID().slice(0,8)}`,runId,severity:'error',kind:'broken-page',url,message:`HTTP ${status}`});
      const anchors=await page.locator('a[href]').evaluateAll((els:any[])=>els.map((el:any)=>({href:el.href,text:(el.innerText||el.getAttribute('aria-label')||'').trim()}))).catch(()=>[]);
      for(const link of anchors as {href:string;text:string}[]){const href=normalizeUrl(link.href,url);if(!href)continue;edges.push({id:`edge_${hashShort(`${url}->${href}`)}`,runId,from:`page:${url}`,to:`page:${href}`,kind:'link',...(link.text?{label:link.text}:{})});const u=new URL(href);if((options.sameOrigin??true)&&u.origin!==origin)continue;if(!visited.has(href))queue.push(href);}
      const interactives=page.locator('button, input:not([type=hidden]), select, textarea, [role=button], [role=link]'); const count=Math.min(await interactives.count(),maxInteractions);
      for(let i=0;i<count;i++){
        const el=interactives.nth(i); let visible=false,enabled=false,label=''; let tag=''; let type='';
        try{visible=await el.isVisible();enabled=await el.isEnabled();tag=await el.evaluate((e:any)=>e.tagName.toLowerCase());type=(await el.getAttribute('type'))??'';label=(await el.getAttribute('aria-label'))??(await el.getAttribute('name'))??(await el.getAttribute('placeholder'))??(await el.innerText().catch(()=>''))??'';}catch{}
        const id=`interaction:${hashShort(`${url}:${i}:${tag}:${label}`)}`;nodes.push({id,runId,url,kind:'control',label:label.trim()||tag,metadata:{visible,enabled,tag,type,index:i}});edges.push({id:`edge_${hashShort(`${url}->${id}`)}`,runId,from:`page:${url}`,to:id,kind:'contains'});
        if(!visible)findings.push({id:`finding_${randomUUID().slice(0,8)}`,runId,severity:'info',kind:'hidden-control',url,element:id,message:`Interactive control is not visible: ${label||tag}`});
        if(visible&&!enabled)findings.push({id:`finding_${randomUUID().slice(0,8)}`,runId,severity:'warning',kind:'disabled-control',url,element:id,message:`Visible control is disabled: ${label||tag}`});
        if(visible&&enabled&&isSafeProbe(tag,type,label,options.includeActions??false)){
          const beforeUrl=page.url(); const beforeFingerprint=await page.locator('body').evaluate((e:any)=>`${e.innerText}|${e.querySelectorAll('*').length}`).catch(()=> '');
          let dialogObserved=false; const dialogHandler=async(d:any)=>{dialogObserved=true;await d.dismiss().catch(()=>undefined);}; page.once('dialog',dialogHandler);
          try{
            await el.click({timeout:3000,noWaitAfter:true}); await page.waitForTimeout(150);
            const afterUrl=page.url(); const afterFingerprint=await page.locator('body').evaluate((e:any)=>`${e.innerText}|${e.querySelectorAll('*').length}`).catch(()=> '');
            if(beforeUrl===afterUrl&&beforeFingerprint===afterFingerprint&&!dialogObserved)findings.push({id:`finding_${randomUUID().slice(0,8)}`,runId,severity:'warning',kind:'null-interaction',url,element:id,message:`Control accepted a click but produced no observable navigation, dialog, or DOM-state change: ${label||tag}`});
          }catch(error){findings.push({id:`finding_${randomUUID().slice(0,8)}`,runId,severity:'warning',kind:'click-failed',url,element:id,message:error instanceof Error?error.message:String(error)});}
          finally{if(page.url()!==url)await page.goto(url,{waitUntil:'domcontentloaded',timeout:options.timeoutMs??15000}).catch(()=>undefined);else await page.reload({waitUntil:'domcontentloaded',timeout:options.timeoutMs??15000}).catch(()=>undefined);}
        }
      }
    }
  } finally { await context.close(); await browser.close(); }
  const endedAt=new Date().toISOString(); const run:InteractionRunRecord={id:runId,kind:'clickthru',target:normalized,engine:`playwright:${browserName}`,startedAt,endedAt,status:findings.some(f=>f.severity==='error')?'failed':'passed',pages:nodes.filter(n=>n.kind==='page').length,interactions:nodes.filter(n=>n.kind!=='page').length,findings:findings.length,metadata:{maxPages}};
  return {run,nodes,edges,findings};
}

export async function runJourney(definition:JourneyDefinition, options:JourneyRunOptions={}):Promise<{run:InteractionRunRecord;steps:JourneyStepResult[];findings:InteractionFinding[]}>{
  const playwright=await loadPlaywright(); const browserName=options.browser??'chromium'; let browser:any;
  try{browser=await playwright[browserName].launch({headless:options.headless??true});}
  catch(error){throw new Error(`Unable to launch ${browserName}. Install its browser runtime first. ${error instanceof Error?error.message:String(error)}`);}
  const context=await browser.newContext(); const page=await context.newPage(); const startedAt=new Date().toISOString(); const runId=`int_${randomUUID().slice(0,8)}`; const results:JourneyStepResult[]=[]; const findings:InteractionFinding[]=[]; let failed=false;
  try{
    for(let i=0;i<definition.steps.length;i++){
      const step=definition.steps[i]!; const started=new Date().toISOString();
      try{await executeJourneyStep(page,step,options.baseUrl??definition.baseUrl,options.inputs??{});results.push({index:i,id:step.id??`step-${i+1}`,type:step.type,status:'passed',startedAt:started,endedAt:new Date().toISOString()});}
      catch(error){failed=true;const message=error instanceof Error?error.message:String(error);results.push({index:i,id:step.id??`step-${i+1}`,type:step.type,status:'failed',startedAt:started,endedAt:new Date().toISOString(),error:message});findings.push({id:`finding_${randomUUID().slice(0,8)}`,runId,severity:'error',kind:'journey-step-failed',url:page.url(),message,...(step.selector?{element:step.selector}:{})});break;}
    }
  } finally {await context.close();await browser.close();}
  const run:InteractionRunRecord={id:runId,kind:'journey',target:definition.name,engine:`playwright:${browserName}`,startedAt,endedAt:new Date().toISOString(),status:failed?'failed':'passed',pages:0,interactions:definition.steps.length,findings:findings.length,metadata:{journey:definition.name,version:definition.version}};
  return {run,steps:results,findings};
}

async function executeJourneyStep(page:any, step:JourneyStep, baseUrl:string|undefined, inputs:Record<string,string>):Promise<void>{
  const value=step.value?interpolate(step.value,inputs):undefined; const selector=step.selector?interpolate(step.selector,inputs):undefined;
  switch(step.type){
    case 'goto': { const target=normalizeUrl(value??'',baseUrl); if(!target)throw new Error(`Invalid journey URL: ${value}`); await page.goto(target,{waitUntil:'domcontentloaded',timeout:step.timeoutMs??15000}); return; }
    case 'click': if(!selector)throw new Error('click requires selector'); await page.locator(selector).click({timeout:step.timeoutMs??10000}); return;
    case 'fill': if(!selector)throw new Error('fill requires selector'); await page.locator(selector).fill(value??'',{timeout:step.timeoutMs??10000}); return;
    case 'press': if(!selector||!value)throw new Error('press requires selector and value'); await page.locator(selector).press(value,{timeout:step.timeoutMs??10000}); return;
    case 'expect-url': if(!value)throw new Error('expect-url requires value'); await page.waitForURL(value,{timeout:step.timeoutMs??10000}); return;
    case 'expect-text': if(!selector||value===undefined)throw new Error('expect-text requires selector and value'); {const text=await page.locator(selector).innerText({timeout:step.timeoutMs??10000}); if(!text.includes(value))throw new Error(`Expected ${selector} to contain ${JSON.stringify(value)}, got ${JSON.stringify(text)}`);} return;
    case 'expect-visible': if(!selector)throw new Error('expect-visible requires selector'); if(!(await page.locator(selector).isVisible({timeout:step.timeoutMs??10000})))throw new Error(`Expected ${selector} to be visible`); return;
  }
}

export function interactionToSemantic(result:CrawlResult, ir:ApplicationIR):ApplicationIR {
  const existing=new Map(ir.nodes.map(n=>[n.id,n])); const edges=[...ir.edges]; const edgeKeys=new Set(edges.map(e=>`${e.from}|${e.relation}|${e.to}`));
  const evidenceId=`evidence:interaction/${result.run.id}`; existing.set(evidenceId,{id:evidenceId,kind:'evidence',label:`${result.run.kind} ${result.run.target}`,metadata:{runId:result.run.id,status:result.run.status,pages:result.run.pages,interactions:result.run.interactions,findings:result.run.findings,engine:result.run.engine}});
  for(const node of result.nodes.filter(n=>n.kind==='page')){
    const routeId=routeIdFromUrl(node.url); if(!routeId)continue;
    const route=existing.get(routeId); if(route){const key=`${evidenceId}|observes|${routeId}`;if(!edgeKeys.has(key)){edges.push({from:evidenceId,to:routeId,relation:'observes',metadata:{status:node.status,url:node.url}});edgeKeys.add(key);}}
  }
  return {...ir,nodes:[...existing.values()],edges,generatedAt:new Date().toISOString()};
}

function routeIdFromUrl(value:string):string|undefined{try{const u=new URL(value);return `route:${u.pathname||'/'}`;}catch{return undefined;}}
function isSafeProbe(tag:string,type:string,label:string,includeActions:boolean):boolean{
  const normalized=label.toLowerCase();
  if(includeActions)return true;
  if(tag==='input'||tag==='select'||tag==='textarea')return false;
  if(type.toLowerCase()==='submit')return false;
  if(/delete|remove|destroy|pay|purchase|buy|submit|save|send|sign ?out|logout|confirm|publish|deploy|charge|refund/.test(normalized))return false;
  return tag==='button'||tag==='div'||tag==='span'||tag==='a';
}
function hashShort(value:string):string{return createHash('sha256').update(value).digest('hex').slice(0,16);}
function interpolate(value:string,inputs:Record<string,string>):string{return value.replace(/\$\{([^}]+)\}/g,(_,k:string)=>inputs[k]??`\${${k}}`);}
async function loadPlaywright():Promise<any>{
  try{const importer=new Function('moduleName','return import(moduleName)') as (name:string)=>Promise<any>;return await importer('playwright');}
  catch{throw new Error('Playwright is required for browser interaction commands. Install it in this project with: npm install -D playwright, then install a browser runtime, e.g. npx playwright install chromium. Static senten crawl does not require Playwright.');}
}

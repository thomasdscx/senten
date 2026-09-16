import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import type { ApplicationIR, GuaranteeResult, ReportRecord, SentenConfig } from '../../core/src/index.js';
import { LocalStateStore } from '../../local-state/src/index.js';
import { evaluateGuarantee, runtimeAlignment, summarizeEvidence } from '../../evidence-intelligence/src/index.js';

export type ReportKind = 'project'|'architecture'|'evidence'|'assurance'|'runtime'|'interactions'|'agents'|'operations';
export type ReportFormat = 'json'|'md'|'html';

export interface ProjectSnapshot {
  schemaVersion:'0.1';
  generatedAt:string;
  application:SentenConfig['application'];
  environment:string;
  architecture:{ nodes:number; edges:number; byKind:Record<string,number>; graph:ApplicationIR };
  operations:{ total:number; applied:number; undone:number; planned:number; failed:number; recent:unknown[] };
  memory:{ total:number; byKind:Record<string,number>; byScope:Record<string,number> };
  workflows:{ total:number; passed:number; failed:number; recent:unknown[] };
  sandboxes:{ total:number; active:number; failed:number; recent:unknown[] };
  interactions:{ total:number; passed:number; failed:number; findings:number; recent:unknown[] };
  agents:{ total:number; active:number; runs:number; failedRuns:number; recentRuns:unknown[] };
  runtime:{ observations:number; traces:number; failures:number; alignment:ReturnType<typeof runtimeAlignment> };
  evidence:{ total:number; summary:ReturnType<typeof summarizeEvidence>; guarantees:GuaranteeResult[] };
  assurance:{ exchanges:number; launchProofResults:number; trustedVerifications:number; cases:number; verifiedCases:number; failedCases:number };
  provenance:{ source:string; stateDb:string; graphFile:string };
}

function countBy<T>(items:T[], key:(item:T)=>string):Record<string,number>{const out:Record<string,number>={};for(const item of items)out[key(item)]=(out[key(item)]??0)+1;return out;}

export async function collectProjectSnapshot(cwd:string):Promise<ProjectSnapshot>{
  const config=JSON.parse(await readFile(join(cwd,'senten.config.json'),'utf8')) as SentenConfig;
  const ir=JSON.parse(await readFile(join(cwd,'.senten','state-truss.json'),'utf8')) as ApplicationIR;
  const store=await LocalStateStore.open(cwd);
  try{
    const operations=store.listOperations(); const states=operations.map(o=>store.currentOperationState(o.id));
    const memory=store.listMemory(); const workflows=store.listWorkflowRuns(); const sandboxes=store.listSandboxes();
    const interactions=store.listInteractionRuns(); const interactionFindings=interactions.flatMap(r=>store.listInteractionFindings(r.id));
    const agents=store.listAgents(); const agentRuns=store.listAgentRuns(); const observations=store.listRuntimeObservations(); const traces=store.listRuntimeTraces(); const evidence=store.listEvidence(); const assuranceExchanges=store.listAssuranceExchanges(); const launchProofResults=store.listLaunchProofResults(); const assuranceCases=store.listAssuranceCases();
    const guarantees=ir.nodes.filter(n=>n.kind==='invariant'||n.kind==='policy').map(n=>evaluateGuarantee(n.id,evidence,ir));
    return {
      schemaVersion:'0.1', generatedAt:new Date().toISOString(), application:config.application, environment:config.environment??'development',
      architecture:{nodes:ir.nodes.length,edges:ir.edges.length,byKind:countBy(ir.nodes,n=>n.kind),graph:ir},
      operations:{total:operations.length,applied:states.filter(s=>s==='applied').length,undone:states.filter(s=>s==='undone').length,planned:states.filter(s=>s==='planned').length,failed:states.filter(s=>s==='failed').length,recent:operations.slice(-12).reverse()},
      memory:{total:memory.length,byKind:countBy(memory,m=>m.kind),byScope:countBy(memory,m=>m.scope)},
      workflows:{total:workflows.length,passed:workflows.filter(w=>w.status==='passed').length,failed:workflows.filter(w=>w.status==='failed').length,recent:workflows.slice(-10).reverse()},
      sandboxes:{total:sandboxes.length,active:sandboxes.filter(s=>s.status==='active').length,failed:sandboxes.filter(s=>s.status==='failed').length,recent:sandboxes.slice(-10).reverse()},
      interactions:{total:interactions.length,passed:interactions.filter(i=>i.status==='passed').length,failed:interactions.filter(i=>i.status==='failed').length,findings:interactionFindings.length,recent:interactions.slice(-10).reverse()},
      agents:{total:agents.length,active:agents.filter(a=>a.status==='active').length,runs:agentRuns.length,failedRuns:agentRuns.filter(r=>r.status==='failed'||r.status==='denied').length,recentRuns:agentRuns.slice(-10).reverse()},
      runtime:{observations:observations.length,traces:traces.length,failures:observations.filter(o=>o.status==='failed'||o.status==='denied').length,alignment:runtimeAlignment(ir,observations)},
      evidence:{total:evidence.length,summary:summarizeEvidence(evidence),guarantees},
      assurance:{exchanges:assuranceExchanges.length,launchProofResults:launchProofResults.length,trustedVerifications:evidence.filter(e=>e.source.startsWith('launchproof:')&&e.status==='verified'&&e.provenance?.publisherTrusted===true).length,cases:assuranceCases.length,verifiedCases:assuranceCases.filter(c=>c.status==='verified').length,failedCases:assuranceCases.filter(c=>c.status==='failed').length},
      provenance:{source:'senten-local-state',stateDb:relative(cwd,store.path),graphFile:'.senten/state-truss.json'}
    };
  }finally{store.close();}
}

function escapeHtml(value:unknown):string{return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
function pct(n:number):string{return `${Math.round(n*1000)/10}%`;}
function table(rows:[string,unknown][]):string{return rows.map(([a,b])=>`| ${a} | ${String(b)} |`).join('\n');}

export function renderMarkdown(snapshot:ProjectSnapshot,kind:ReportKind='project'):string{
  const g=snapshot.evidence.guarantees;
  const header=`# Senten ${title(kind)} Report\n\nGenerated: ${snapshot.generatedAt}\n\nApplication: **${snapshot.application.name}**\n\nEnvironment: **${snapshot.environment}**\n\n`;
  const overview=`## Overview\n\n| Metric | Value |\n| --- | ---: |\n${table([
    ['Semantic nodes',snapshot.architecture.nodes],['Semantic edges',snapshot.architecture.edges],['Operations',snapshot.operations.total],['Memory records',snapshot.memory.total],['Workflow runs',snapshot.workflows.total],['Interaction runs',snapshot.interactions.total],['Runtime observations',snapshot.runtime.observations],['Evidence records',snapshot.evidence.total],['Assurance cases',snapshot.assurance.cases]
  ])}\n\n`;
  const guarantees=`## Guarantees\n\n${g.length?g.map(x=>`- **${x.status.toUpperCase()}** · S${x.strength} · \`${x.target}\` — ${x.reason}`).join('\n'):'No policy or invariant guarantees declared.'}\n\n`;
  const runtime=`## Runtime Alignment\n\n- Coverage: **${pct(snapshot.runtime.alignment.coverage)}**\n- Matched subjects: ${snapshot.runtime.alignment.matched}\n- Runtime-only subjects: ${snapshot.runtime.alignment.runtimeOnly.length}\n- Unobserved subjects: ${snapshot.runtime.alignment.unobserved.length}\n- Runtime failures: ${snapshot.runtime.failures}\n\n`;
  const assurance=`## Independent Assurance\n\n- LaunchProof exchanges: ${snapshot.assurance.exchanges}\n- LaunchProof result bundles: ${snapshot.assurance.launchProofResults}\n- Trusted verification evidence: ${snapshot.assurance.trustedVerifications}\n- Assurance Cases: ${snapshot.assurance.cases}\n- Verified cases: ${snapshot.assurance.verifiedCases}\n- Failed cases: ${snapshot.assurance.failedCases}\n\n`;
  const architecture=`## Architecture\n\n${Object.entries(snapshot.architecture.byKind).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n\n`;
  const provenance=`## Provenance\n\n- Source: ${snapshot.provenance.source}\n- State database: \`${snapshot.provenance.stateDb}\`\n- StateTruss: \`${snapshot.provenance.graphFile}\`\n`;
  if(kind==='architecture')return header+architecture+provenance;
  if(kind==='evidence')return header+guarantees+runtime+provenance;
  if(kind==='assurance')return header+assurance+guarantees+provenance;
  if(kind==='runtime')return header+runtime+provenance;
  if(kind==='interactions')return header+`## Interaction Assurance\n\n- Runs: ${snapshot.interactions.total}\n- Passed: ${snapshot.interactions.passed}\n- Failed: ${snapshot.interactions.failed}\n- Findings: ${snapshot.interactions.findings}\n\n`+provenance;
  if(kind==='agents')return header+`## Agents\n\n- Configured: ${snapshot.agents.total}\n- Active: ${snapshot.agents.active}\n- Runs: ${snapshot.agents.runs}\n- Failed/denied runs: ${snapshot.agents.failedRuns}\n\n`+provenance;
  if(kind==='operations')return header+`## Operations\n\n- Total: ${snapshot.operations.total}\n- Applied: ${snapshot.operations.applied}\n- Undone: ${snapshot.operations.undone}\n- Planned: ${snapshot.operations.planned}\n- Failed: ${snapshot.operations.failed}\n\n`+provenance;
  return header+overview+architecture+guarantees+assurance+runtime+provenance;
}
function title(kind:ReportKind):string{return kind[0]!.toUpperCase()+kind.slice(1);}

export function renderHtml(snapshot:ProjectSnapshot,kind:ReportKind='project'):string{
  const md=renderMarkdown(snapshot,kind);
  const metrics=[['Architecture',`${snapshot.architecture.nodes} nodes / ${snapshot.architecture.edges} edges`],['Evidence',`${snapshot.evidence.total} records`],['Runtime',`${pct(snapshot.runtime.alignment.coverage)} observed`],['Interactions',`${snapshot.interactions.findings} findings`]];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Senten ${escapeHtml(title(kind))} Report</title><style>
  :root{color-scheme:dark;--bg:#0b0d11;--panel:#12161d;--line:#252b36;--text:#f4f6f8;--muted:#9ca6b5;--accent:#8cf0c8}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 Inter,ui-sans-serif,system-ui;padding:48px}.wrap{max-width:1080px;margin:auto}.eyebrow{letter-spacing:.12em;text-transform:uppercase;color:var(--accent);font-size:12px}h1{font-size:44px;margin:.2em 0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:30px 0}.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}.card b{display:block;font-size:20px;margin-top:6px}pre{white-space:pre-wrap;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:26px;color:var(--text)}.muted{color:var(--muted)}@media(max-width:760px){body{padding:20px}.grid{grid-template-columns:1fr 1fr}h1{font-size:34px}}@media print{body{background:#fff;color:#111}.card,pre{background:#fff;border-color:#ddd;color:#111}.eyebrow{color:#111}}</style></head><body><main class="wrap"><div class="eyebrow">Senten · Architecture for Living Software</div><h1>${escapeHtml(title(kind))} Report</h1><div class="muted">${escapeHtml(snapshot.application.name)} · ${escapeHtml(snapshot.generatedAt)}</div><section class="grid">${metrics.map(([a,b])=>`<div class="card"><span class="muted">${escapeHtml(a)}</span><b>${escapeHtml(b)}</b></div>`).join('')}</section><pre>${escapeHtml(md)}</pre></main></body></html>`;
}

export function renderReport(snapshot:ProjectSnapshot,format:ReportFormat,kind:ReportKind='project'):string{
  if(format==='json')return JSON.stringify({kind,snapshot},null,2)+'\n';
  if(format==='md')return renderMarkdown(snapshot,kind);
  return renderHtml(snapshot,kind);
}

export async function writeReport(cwd:string,input:{kind?:ReportKind;format?:ReportFormat;output?:string}={}):Promise<ReportRecord>{
  const kind=input.kind??'project',format=input.format??'html',snapshot=await collectProjectSnapshot(cwd),content=renderReport(snapshot,format,kind);
  const ext=format==='md'?'md':format; const dir=join(cwd,'.senten','artifacts','reports'); await mkdir(dir,{recursive:true});
  const id=`rpt_${randomUUID().slice(0,10)}`; const output=input.output?join(cwd,input.output):join(dir,`${kind}-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`);
  await mkdir(dirname(output),{recursive:true}); await writeFile(output,content);
  const rec:ReportRecord={id,kind,format,createdAt:snapshot.generatedAt,path:relative(cwd,output).replaceAll('\\','/'),digest:createHash('sha256').update(content).digest('hex'),applicationId:snapshot.application.id,metadata:{bytes:Buffer.byteLength(content),filename:basename(output)}};
  const store=await LocalStateStore.open(cwd);try{store.putReport(rec);}finally{store.close();}return rec;
}

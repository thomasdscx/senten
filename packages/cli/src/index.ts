import { access, appendFile, copyFile, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { actorFromString, parseElementRef, type AgentProfile, type AgentRunRecord, type AssuranceCaseRecord, type AssuranceExchangeBundle, type ChangeBundle, type TaskContextBundle, type ActorIdentity, type ApplicationIR, type CheckpointRecord, type JourneyDefinition, type LaunchProofResultBundle, type MemoryKind, type MemoryScope, type OperationEvent, type OperationRecord, type PackageKind, type EvidenceRecord, type RuntimeObservationRecord, type ProfileRecord, type RegistryConfig, type RollbackRecipe, type SemanticNode, type SentenConfig, type SessionRecord, type TransactionRecord, type WorkflowDefinition, type WorkflowRunRecord } from '../../core/src/index.js';
import { StateTrussGraph } from '../../semantic/src/index.js';
import { ExtensionRegistry } from '../../extension-sdk/src/index.js';
import { DockerSandboxProvider, LocalSandboxProvider, assertSandboxEffectBoundary, createSandboxRunRecord, createSnapshot, expiredSandbox, providerFor, restoreSnapshot, workspaceDigest, type SandboxProviderKind } from '../../sandbox/src/index.js';
import { LocalStateStore } from '../../local-state/src/index.js';
import { MemoryService } from '../../memory/src/index.js';
import { applyTemplate, createPackageFromDirectory, loadPackage, verifyPackage } from '../../templates/src/index.js';
import { HttpRegistry, LocalRegistry, registryFor, type RegistryEntry } from '../../registry/src/index.js';
import { executeWorkflow, loadWorkflow, resolveWorkflowInputs, validateWorkflow, workflowPlan } from '../../workflows/src/index.js';
import { discoverSourceProject, diffIR, summarizeDiff, type SemanticDiff } from '../../source-intelligence/src/index.js';
import { buildChangeBundle, buildTaskContext, commandCapability, createAgent, addGrant, removeGrant, permissionDecision } from '../../agent-intelligence/src/index.js';
import { clickthruWebsite, crawlWebsite, interactionToSemantic, runJourney } from '../../interaction/src/index.js';
import { buildTrace, evidenceStrength, evidenceToSemantic, evaluateGuarantee, normalizeEvidence, normalizeRuntimeObservation, observationToEvidence, runtimeAlignment, summarizeEvidence } from '../../evidence-intelligence/src/index.js';
import { reactAdapter } from '../../../adapters/react/src/index.js';
import { nextAdapter } from '../../../adapters/next/src/index.js';
import { expoAdapter } from '../../../adapters/expo/src/index.js';
import { tauriAdapter } from '../../../adapters/tauri/src/index.js';
import { supabaseAdapter } from '../../../adapters/supabase/src/index.js';
import { gitIntegration } from '../../../integrations/git/src/index.js';
import { launchProofIntegration, launchProofResultToEvidence } from '../../../integrations/launchproof/src/index.js';
import { createAssuranceCase, createAssuranceExchange, evaluateAssuranceCase, extractAssuranceClaims } from '../../assurance/src/index.js';
import { collectProjectSnapshot, writeReport, type ReportFormat, type ReportKind } from '../../reporting/src/index.js';
import { startObservatory } from '../../observatory/src/index.js';
import { checkCompatibility, generateSigningKey, loadTrustStore, signPackageManifest, trustPublicKey, verifyManifestSignatures } from '../../package-security/src/index.js';
import { benchmark, runReleaseReadiness } from '../../release-readiness/src/index.js';
import { analyzeAdoption } from '../../adoption/src/index.js';
import { CapabilityRegistry, evaluateBudget, type CapabilityProvider, type OperationalBudget, type BudgetUsage } from '../../capabilities/src/index.js';
import { compatibilityReport } from '../../stabilization/src/index.js';
import { buildMcpToolDefinitions, runMcpStdioServer } from '../../mcp/src/index.js';
import { computeBlastRadius } from '../../impact-intelligence/src/index.js';
import { exportScenarioArtifacts, listScenarios, runScenario } from '../../scenario-lab/src/index.js';

const VERSION = '1.0.0-rc.3';
const CORE_COMMANDS = ['welcome','init','adopt','declare','relate','why','lineage','capability','simulate','compatibility','create','use','discover','source','baseline','diff','drift','inspect','explain','graph','impact','element','history','undo','redo','session','transaction','checkpoint','rollback','memory','recall','profile','template','blueprint','registry','package','trust','workflow','cache','extensions','sandbox','crawl','clickthru','journey','paths','runtime','evidence','guarantee','assurance','launchproof','agent','context','commands','mcp','doctor','proof','report','observatory','release','benchmark','schema','scenario','showcase'] as const;

export async function main(argv: string[]): Promise<void> {
  const cwd = process.cwd(); const [command, ...rest] = argv;
  if (!command) return printWelcome();
  if (['help','--help','-h'].includes(command)) return printHelp();
  if (['--version','-v','version'].includes(command)) return console.log(VERSION);
  const registry = defaultRegistry();
  switch (command) {
    case 'welcome': return printWelcome();
    case 'init': return initCommand(cwd, rest, registry);
    case 'adopt': return adoptCommand(cwd, rest);
    case 'declare': return declareCommand(cwd, rest);
    case 'relate': return relateCommand(cwd, rest);
    case 'why': return whyCommand(cwd, rest);
    case 'lineage': return lineageCommand(cwd, rest);
    case 'capability': return capabilityCommand(cwd, rest);
    case 'simulate': return simulateCommand(cwd, rest);
    case 'compatibility': return compatibilityCommand(cwd, rest);
    case 'create': return createCommand(cwd, rest);
    case 'use': return useCommand(cwd, rest, registry);
    case 'discover': return discoverCommand(cwd, rest);
    case 'source': return sourceCommand(cwd, rest);
    case 'baseline': return baselineCommand(cwd, rest);
    case 'diff': return diffCommand(cwd, rest);
    case 'drift': return driftCommand(cwd, rest);
    case 'inspect': return inspectProject(cwd, rest);
    case 'explain': return explain(cwd, rest);
    case 'graph': return graph(cwd, rest);
    case 'impact': return impact(cwd, rest);
    case 'element': return element(cwd, rest);
    case 'history': return history(cwd, rest);
    case 'undo': return undo(cwd, rest);
    case 'redo': return redo(cwd, rest);
    case 'session': return sessionCommand(cwd, rest);
    case 'transaction': return transactionCommand(cwd, rest);
    case 'checkpoint': return checkpointCommand(cwd, rest);
    case 'rollback': return rollbackCommand(cwd, rest);
    case 'memory': return memoryCommand(cwd, rest);
    case 'recall': return recallCommand(cwd, rest);
    case 'profile': return profileCommand(cwd, rest);
    case 'template': return templateCommand(cwd, rest, registry);
    case 'blueprint': return templateCommand(cwd, ['--kind','blueprint',...rest], registry);
    case 'registry': return registryCommand(cwd, rest);
    case 'package': return packageCommand(cwd, rest);
    case 'trust': return trustCommand(cwd, rest);
    case 'workflow': return workflowCommand(cwd, rest, registry);
    case 'cache': return cacheCommand(cwd, rest);
    case 'extensions': return extensions(registry, rest);
    case 'sandbox': return sandbox(cwd, rest);
    case 'crawl': return crawlCommand(cwd, rest);
    case 'clickthru': return clickthruCommand(cwd, rest);
    case 'journey': return journeyCommand(cwd, rest);
    case 'paths': return pathsCommand(cwd, rest);
    case 'runtime': return runtimeCommand(cwd, rest);
    case 'evidence': return evidenceCommand(cwd, rest);
    case 'guarantee': return guaranteeCommand(cwd, rest);
    case 'assurance': return assuranceCommand(cwd, rest);
    case 'launchproof': return launchProofCommand(cwd, rest);
    case 'agent': return agentCommand(cwd, rest, registry);
    case 'context': return contextCommand(cwd, rest);
    case 'commands': return commandsCommand(registry, rest);
    case 'mcp': return mcpCommand(registry, rest);
    case 'doctor': return doctor(cwd, rest);
    case 'proof': return proof(cwd, rest);
    case 'report': return reportCommand(cwd, rest);
    case 'observatory': return observatoryCommand(cwd, rest);
    case 'release': return releaseCommand(cwd, rest);
    case 'benchmark': return benchmarkCommand(cwd, rest);
    case 'schema': return schemaCommand(registry, rest);
    case 'scenario': return scenarioCommand(cwd, rest);
    case 'showcase': return showcaseCommand(cwd, rest);
    default: { const ext=registry.get(command); if(ext) return runExtension(registry,command,cwd,rest); const suggestion=suggestCommand(command,[...CORE_COMMANDS,...registry.list().map(e=>e.namespace)]); console.error(`Unknown command: ${command}${suggestion?`\nDid you mean: ${suggestion}?`:''}\n`); printHelp(); process.exitCode=2; }
  }
}


function printWelcome(): void { console.log(`SENTEN
Architecture for Living Software

Version ${VERSION}
Runtime  Node.js >=22.5 (canonical)
Bun      experimental compatibility target

Get started
  senten init
  senten discover
  senten doctor

Explore
  senten commands
  senten observatory
  senten scenario list
  senten showcase build
  senten --help

Docs
  https://github.com/thomasdscx/senten#readme
`); }

function printHelp(): void { console.log(`Senten ${VERSION} — Architecture for Living Software.

Usage:
  senten <command> [target] [options]

Build & architecture:
  init [template ...]            Initialize Senten or create from a template
  create <type> <name>           Create files, dirs, templates, profiles, checkpoints
  use template <name>            Apply a reusable template to the current project
  discover [--force]            Parse source and populate StateTruss automatically
  adopt [--json]                 Initialize/discover an existing app and produce an adoption plan
  declare <kind> <id>            Add an explicit semantic contract node
  relate <from> <relation> <to>  Add an explicit semantic relationship
  why <element>                  Explain semantic relationships and architectural rationale
  lineage <element>              Trace semantic data/effect lineage across the graph
  capability <...>               Provider-neutral capabilities, health and operational budgets
  simulate <fault>               Record a safe deterministic failure-injection plan
  compatibility                  Check IR/protocol compatibility for stabilization
  source <status|files>          Inspect source-intelligence state
  baseline <create|list|accept>  Architecture baselines for drift detection
  diff [--against <baseline>]    Semantic architecture diff
  drift                         Compare source architecture to accepted baseline
  inspect | explain | graph      Inspect StateTruss and Universal Elements
  impact <element>               Show semantic impact

Safe change control:
  element <target> <action>      inspect/copy/move/rename/delete
  history [selectors]            Immutable operation ledger view
  undo [id|all]                  Architecture-aware reversal (all previews by default)
  redo [id|all]                  Reapply undone operations (all previews by default)
  session <start|end|list>       Scope human/agent work
  transaction <start|end>        Group operations into one logical change
  checkpoint <create|list>       Record rollback boundaries
  rollback checkpoint:<id>       Reverse applied operations after a checkpoint

Knowledge & reuse:
  memory <add|list|project>      Typed/scoped project memory
  recall <subject>               Resolve project/team/profile memory
  profile <create|use|list>      Development defaults and team behavior
  template <list|inspect|create> Reusable implementation packages
  workflow <...>                 Build, validate and run deterministic command automation
  blueprint <...>                Reusable semantic architecture packages
  registry <list|add|search>     Decentralized package registries
  package <inspect|verify|sign|install> Inspect, sign, verify and install packages
  trust <list|add|keygen>        Publisher trust and signing keys
  cache <status|clear>           Rebuildable local cache

Safety & ecosystem:
  sandbox <...>                  Disposable local/Docker execution, snapshots & replay
  crawl <url>                    Crawl routes, links and HTTP health
  clickthru <url>                Browser-driven interaction inventory and validation
  journey <...>                  Define and run critical user journeys
  paths [run-id]                 Inspect discovered navigation/interaction graph
  runtime <...>                  Ingest/inspect runtime observations and traces
  evidence <...>                 Evidence ledger, summaries and provenance
  guarantee <target>             Evaluate evidence for a declared guarantee
  assurance <claims|case>         Assurance claims and Assurance Cases
  launchproof <export|import>      Independent LaunchProof verification interchange
  extensions                    Registered adapters/integrations
  agent <...>                   Bounded agent identities, grants, runs & provenance
  context --task <task>         Generate compact machine-readable task context
  commands [--json]             Discover Senten command capabilities for agents
  mcp schema                    Emit MCP-facing tool schema foundation
  doctor                        Local state/config health
  proof [target]                Guarantee/evidence status
  report <kind|list>            Canonical JSON/Markdown/HTML reports
  observatory                   Local application intelligence workbench
  release check [--rc]          Public-release / RC readiness and security gate
  benchmark                     Measure local Senten read-path performance
  schema command <name>         Machine-readable command schema

Examples:
  senten init
  senten create sandbox --provider docker --network deny
  senten discover
  senten baseline accept
  senten drift
  senten create file notes.md
  senten create template my-saas
  senten init template my-saas
  senten init template react basic
  senten memory add decision database "Use PostgreSQL for transactional state"
  senten session start "billing refactor"
  senten element logo.png move assets/branding
  senten undo
  senten undo all --today
  senten undo all --today --apply
  senten checkpoint create before-auth
  senten create workflow pre-release --empty
  senten workflow add pre-release -- doctor
  senten workflow add pre-release -- discover
  senten workflow add pre-release -- drift --strict
  senten workflow steps pre-release
  senten workflow validate pre-release
  senten workflow run pre-release --dry-run
  senten crawl http://localhost:3000
  senten clickthru http://localhost:3000 --browser chromium
  senten journey create checkout http://localhost:3000
  senten runtime observe invariant:tenant-isolation --kind invariant --status passed
  senten evidence summary invariant:tenant-isolation
  senten guarantee invariant:tenant-isolation
  senten report project --format html
  senten observatory --open
  senten agent create codex --provider openai --model codex
  senten agent grant codex project.read
  senten context --task "modify billing safely" --agent codex
`); }

function defaultRegistry(): ExtensionRegistry { return new ExtensionRegistry().register(reactAdapter).register(nextAdapter).register(expoAdapter).register(tauriAdapter).register(supabaseAdapter).register(gitIntegration).register(launchProofIntegration); }

async function initCommand(cwd:string,args:string[],registry:ExtensionRegistry):Promise<void>{
  if(args[0]==='template'){
    const namespaceOrName=args[1]; const maybeName=args[2]; if(!namespaceOrName)throw new Error('Usage: senten init template <template> OR senten init template <extension> <template>');
    if(maybeName){ const registration=registry.templates(namespaceOrName).find(x=>x.template.name===maybeName); if(!registration)throw new Error(`Extension template not registered: ${namespaceOrName}/${maybeName}`); if(!registration.template.path) throw new Error(`${namespaceOrName}/${maybeName} is registered semantically but has no bundled generator yet. Install a package-backed template or use: senten template list ${namespaceOrName}`); await initProject(cwd,[]); await applyTemplate(registration.template.path,cwd,parseVars(args),{force:args.includes('--force')}); return; }
    await initProject(cwd,[]); await applyNamedTemplate(cwd,namespaceOrName,parseVars(args)); return;
  }
  await initProject(cwd,args);
}

async function initProject(cwd:string,args:string[]):Promise<void>{
  const force=args.includes('--force'); const sentenDir=join(cwd,'.senten'); await mkdir(join(sentenDir,'cache'),{recursive:true}); await mkdir(join(sentenDir,'packages'),{recursive:true}); await mkdir(join(sentenDir,'artifacts'),{recursive:true});
  const configPath=join(cwd,'senten.config.json'); if(!force&&await exists(configPath))throw new Error('senten.config.json already exists. Use --force to replace it.');
  const name=basename(cwd); const config:SentenConfig={application:{id:slug(name),name},environment:'development',extensions:['react','git','launchproof'],registries:[{name:'local',type:'local',location:'.senten/packages',trusted:true}]};
  await writeFile(configPath,JSON.stringify(config,null,2)+'\n'); const graph=new StateTrussGraph(config.application); graph.addNode({id:`application:${config.application.id}`,kind:'application',label:config.application.name}); await writeIR(cwd,graph.toIR());
  const store=await LocalStateStore.open(cwd); await migrateLegacyHistory(cwd,store); store.set('schema.version','0.20.0'); store.close();
  console.log(`✓ Senten initialized\n\nApplication  ${config.application.name}\nState        .senten/senten.db\nCache        .senten/cache/\nRegistry     local (.senten/packages)\n\nNext\n  senten discover\n  senten doctor\n\nExplore\n  senten commands\n  senten observatory`);
}

async function createCommand(cwd:string,args:string[]):Promise<void>{
  const type=args[0];
  if(type==='sandbox') return sandbox(cwd,['create',...args.slice(1)]);
  const name=args[1]; if(!type||!name)throw new Error('Usage: senten create <file|dir|template|blueprint|profile|workflow|sandbox|checkpoint|decision> <name>');
  if(type==='file'||type==='dir') return createFs(cwd,type,name,args.slice(2));
  if(type==='template'||type==='blueprint') return createTemplatePackage(cwd,type,name,args.slice(2));
  if(type==='profile') return createProfile(cwd,name,args.slice(2));
  if(type==='workflow') return createWorkflowFile(cwd,name,args.slice(2));
  if(type==='checkpoint') return checkpointCommand(cwd,['create',name,...args.slice(2)]);
  if(type==='decision'){ const text=args.slice(2).filter(a=>!a.startsWith('--')).join(' '); if(!text)throw new Error('Usage: senten create decision <subject> <decision text>'); return addMemory(cwd,'decision','project',name,text,args); }
  throw new Error(`Unknown creatable type: ${type}`);
}

async function createFs(cwd:string,type:'file'|'dir',name:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const target=resolveElementPath(cwd,name); if(await exists(target))throw new Error(`Target already exists: ${name}`); const dryRun=args.includes('--dry-run');
  const operation=await makeOperation(cwd,{action:'create',intent:`create ${type} ${name}`,targets:[relative(cwd,target)],dryRun,rollback:{type:'delete-created',path:relative(cwd,target)},reversibility:'reversible',actor:actorFlag(args)});
  if(!dryRun){ if(type==='dir')await mkdir(target,{recursive:true}); else{await mkdir(dirname(target),{recursive:true});await writeFile(target,'');} operation.rollback=type==='file'?{type:'delete-created',path:relative(cwd,target),expectedHash:await hashFile(target)}:{type:'delete-created',path:relative(cwd,target)}; }
  await recordOperation(cwd,operation); console.log(`${dryRun?'PLANNED':'APPLIED'} ${operation.id}\nCREATE ${type} ${relative(cwd,target)}`);
}

async function useCommand(cwd:string,args:string[],registry:ExtensionRegistry):Promise<void>{ if(args[0]==='workflow'&&args[1])return workflowCommand(cwd,['run',args[1],...args.slice(2)],registry); if(args[0]!=='template'||!args[1])throw new Error('Usage: senten use <template|workflow> <name>'); const name=args[1]; const extTemplate=args[2]?registry.templates(name).find(x=>x.template.name===args[2]):undefined; if(extTemplate){if(!extTemplate.template.path)throw new Error(`${name}/${args[2]} has no bundled generator yet.`);return applyTemplate(extTemplate.template.path,cwd,parseVars(args),{force:args.includes('--force')});} return applyNamedTemplate(cwd,name,parseVars(args)); }

async function createTemplatePackage(cwd:string,kind:'template'|'blueprint',name:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const out=join(cwd,'.senten','packages'); const result=await createPackageFromDirectory(cwd,out,name,kind); console.log(`CREATED ${kind.toUpperCase()} ${result.manifest.name}\nPath      ${relative(cwd,result.root)}\nFiles     ${result.files.length}\nExcluded  ${result.excluded.length}`); if(result.excluded.length&&args.includes('--verbose'))for(const x of result.excluded)console.log(`  excluded ${x}`);
}

async function applyNamedTemplate(cwd:string,name:string,vars:Record<string,string>):Promise<void>{ const config=await loadConfig(cwd); const registries=config.registries??[{name:'local',type:'local',location:'.senten/packages',trusted:true}]; for(const r of registries){if(r.type!=='local')continue;const local=new LocalRegistry({...r,location:resolve(cwd,r.location)});const entry=await local.find(name,'template')??await local.find(name,'blueprint');if(entry){await applyTemplate(entry.path,cwd,vars);console.log(`APPLIED ${entry.manifest.kind.toUpperCase()} ${entry.manifest.name}`);return;}} const direct=join(cwd,'.senten','packages',`template-${slug(name)}`); if(await exists(join(direct,'senten.package.json'))){await applyTemplate(direct,cwd,vars);console.log(`APPLIED TEMPLATE ${name}`);return;} throw new Error(`Template not found: ${name}`); }


async function discoverCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const config=await loadConfig(cwd); const previous=await loadIR(cwd);
  const baselines=join(cwd,'.senten','baselines'); await mkdir(baselines,{recursive:true});
  await writeFile(join(baselines,'previous.json'),JSON.stringify(previous,null,2)+'\n');
  const result=await discoverSourceProject(cwd,config.application,previous,{force:args.includes('--force'),analyzers:defaultRegistry().sourceAnalyzers()}); await writeIR(cwd,result.ir);
  const store=await LocalStateStore.open(cwd); store.set('source.last-discovery',result.ir.generatedAt); store.set('source.frameworks',JSON.stringify(result.frameworks)); store.set('source.stats',JSON.stringify(result.stats)); store.close();
  if(args.includes('--json')) return console.log(JSON.stringify({frameworks:result.frameworks,stats:result.stats,ir:result.ir},null,2));
  console.log(`SOURCE DISCOVERY\nFiles        ${result.stats.files}\nParsed       ${result.stats.parsed}\nCache hits   ${result.stats.cacheHits}\nCache misses ${result.stats.cacheMisses}\nNodes        ${result.stats.nodes}\nEdges        ${result.stats.edges}\nFrameworks   ${result.frameworks.join(', ')||'none detected'}\nDuration     ${result.stats.durationMs}ms\nStateTruss   updated`);
}

async function sourceCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const action=args[0]??'status'; const manifestPath=join(cwd,'.senten','cache','source','manifest.json');
  if(!await exists(manifestPath)){console.log('SOURCE INTELLIGENCE\nNo source discovery has been run.\nRun: senten discover');return;}
  const manifest=JSON.parse(await readFile(manifestPath,'utf8')) as {generatedAt:string;parserVersion:string;frameworks:string[];files:{path:string;hash:string}[]};
  if(action==='files'){for(const f of manifest.files)console.log(`${f.hash.slice(0,12)}  ${f.path}`);return;}
  const store=await LocalStateStore.open(cwd); const statsRaw=store.get('source.stats'); store.close(); const stats=statsRaw?JSON.parse(statsRaw):undefined;
  if(args.includes('--json'))return console.log(JSON.stringify({manifest,stats},null,2));
  console.log(`SOURCE INTELLIGENCE\nLast scan    ${manifest.generatedAt}\nParser       ${manifest.parserVersion}\nFiles        ${manifest.files.length}\nFrameworks   ${manifest.frameworks.join(', ')||'none'}${stats?`\nCache hits   ${stats.cacheHits}\nCache misses ${stats.cacheMisses}`:''}`);
}

async function baselineCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const action=args[0]??'list'; const dir=join(cwd,'.senten','baselines'); await mkdir(dir,{recursive:true});
  if(action==='create'||action==='accept'){const name=action==='accept'?(args[1]??'architecture'):(args[1]??`baseline-${Date.now()}`); const ir=await loadIR(cwd); const path=join(dir,`${slug(name)}.json`); await writeFile(path,JSON.stringify(ir,null,2)+'\n'); console.log(`BASELINE ${action==='accept'?'ACCEPTED':'CREATED'} ${slug(name)}\nNodes ${ir.nodes.length}\nEdges ${ir.edges.length}\nPath  ${relative(cwd,path)}`);return;}
  if(action==='list'){const rows=(await readdir(dir)).filter(x=>x.endsWith('.json'));if(!rows.length)return console.log('No architecture baselines.');for(const row of rows){const ir=JSON.parse(await readFile(join(dir,row),'utf8')) as ApplicationIR;console.log(`${row.replace(/\.json$/,'').padEnd(24)} ${ir.generatedAt}  ${ir.nodes.length} nodes / ${ir.edges.length} edges`);}return;}
  throw new Error('Usage: senten baseline <create|accept|list> [name]');
}

async function currentDiscoveredIR(cwd:string,args:string[]):Promise<ApplicationIR>{const config=await loadConfig(cwd);const existing=await loadIR(cwd);const result=await discoverSourceProject(cwd,config.application,existing,{force:args.includes('--force'),analyzers:defaultRegistry().sourceAnalyzers()});await writeIR(cwd,result.ir);return result.ir;}
async function loadBaseline(cwd:string,name:string):Promise<ApplicationIR>{const path=join(cwd,'.senten','baselines',`${slug(name)}.json`);if(!await exists(path))throw new Error(`Architecture baseline not found: ${name}. Run: senten baseline accept`);return JSON.parse(await readFile(path,'utf8')) as ApplicationIR;}

async function diffCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const name=flagValue(args,'--against')??((await exists(join(cwd,'.senten','baselines','previous.json')))?'previous':'architecture');const before=await loadBaseline(cwd,name);const after=await currentDiscoveredIR(cwd,args);const d=diffIR(before,after);printSemanticDiff(d,`SEMANTIC DIFF — ${name} → current`,args.includes('--json'));
}

async function driftCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const baseline=await loadBaseline(cwd,flagValue(args,'--against')??'architecture');const current=await currentDiscoveredIR(cwd,args);const d=diffIR(baseline,current);const summary=summarizeDiff(d);printSemanticDiff(d,'ARCHITECTURE DRIFT',args.includes('--json'));
  if(args.includes('--strict')&&(summary.removedNodes||summary.changedNodes||summary.removedEdges||summary.breaking))process.exitCode=1;
}

function printSemanticDiff(d:SemanticDiff,title:string,json:boolean):void{if(json){console.log(JSON.stringify({...summarizeDiff(d),...d},null,2));return;}const s=summarizeDiff(d);console.log(`${title}\nAdded nodes    ${s.addedNodes}\nRemoved nodes  ${s.removedNodes}\nChanged nodes  ${s.changedNodes}\nAdded edges    ${s.addedEdges}\nRemoved edges  ${s.removedEdges}\nBreaking       ${s.breaking}`);for(const n of d.addedNodes.slice(0,25))console.log(`  + ${n.id}`);for(const n of d.removedNodes.slice(0,25))console.log(`  - ${n.id}`);for(const n of d.changedNodes.slice(0,25))console.log(`  ~ ${n.after.id}`);for(const b of d.breaking)console.log(`  ! ${b}`);if(d.addedNodes.length+d.removedNodes.length+d.changedNodes.length>75)console.log('  … output truncated; use --json for the complete diff.');}

async function inspectProject(cwd:string,args:string[]):Promise<void>{ const format=flagValue(args,'--format')??(args.includes('--json')?'json':'human'); const ir=await loadIR(cwd); const store=await LocalStateStore.open(cwd); const sourceStatsRaw=store.get('source.stats');const sourceFrameworksRaw=store.get('source.frameworks');const summary={application:ir.application,schemaVersion:ir.schemaVersion,nodes:ir.nodes.length,edges:ir.edges.length,kinds:countBy(ir.nodes,n=>n.kind),operations:store.listOperations().length,operationEvents:store.eventCount(),memories:store.listMemory().length,sessions:store.listSessions().length,runtimeObservations:store.listRuntimeObservations().length,runtimeTraces:store.listRuntimeTraces().length,evidence:store.listEvidence().length,source:sourceStatsRaw?JSON.parse(sourceStatsRaw):undefined,frameworks:sourceFrameworksRaw?JSON.parse(sourceFrameworksRaw):[],generatedAt:ir.generatedAt};store.close();if(format==='json')console.log(JSON.stringify(summary,null,2));else{console.log(`SENTEN INSPECT\nApplication  ${ir.application.name}\nIR           ${ir.schemaVersion}\nNodes        ${ir.nodes.length}\nEdges        ${ir.edges.length}\nOperations   ${summary.operations}\nMemory       ${summary.memories}\nSessions     ${summary.sessions}\nRuntime      ${summary.runtimeObservations} observations / ${summary.runtimeTraces} traces\nEvidence     ${summary.evidence}${summary.source?`\nSource files ${summary.source.files}\nFrameworks   ${summary.frameworks.join(', ')||'none'}`:''}`);for(const [kind,count] of Object.entries(summary.kinds))console.log(`${kind.padEnd(12)} ${count}`);} }
async function explain(cwd:string,args:string[]):Promise<void>{const target=args.find(a=>!a.startsWith('-'));if(!target)throw new Error('Usage: senten explain <element>');const ir=await loadIR(cwd);const graph=StateTrussGraph.fromIR(ir);const ref=resolveSemanticRef(target,ir.nodes);const node=graph.get(ref);if(!node){const elementRef=parseElementRef(target);const path=resolveElementPath(cwd,elementRef.id);if(await exists(path)){const info=await stat(path);console.log(`ELEMENT\nTarget       ${target}\nResolved     ${relative(cwd,path)||'.'}\nType         ${info.isDirectory()?'directory':'file'}\nSize         ${info.size} bytes`);return;}throw new Error(`Unknown element: ${target}`);}console.log(JSON.stringify({node,related:graph.related(node.id)},null,2));}
async function graph(cwd:string,args:string[]):Promise<void>{const format=flagValue(args,'--format')??(args.includes('--json')?'json':'human');const ir=await loadIR(cwd);if(format==='json')return console.log(JSON.stringify(ir,null,2));console.log(`STATETRUSS — ${ir.application.name}`);for(const node of ir.nodes)console.log(`• ${node.id} [${node.kind}]`);for(const edge of ir.edges)console.log(`  ${edge.from} -(${edge.relation})-> ${edge.to}`);}
async function impact(cwd:string,args:string[]):Promise<void>{const target=args.find(a=>!a.startsWith('-'));if(!target)throw new Error('Usage: senten impact <semantic-element> [--depth N] [--json]');const ir=await loadIR(cwd);const id=resolveSemanticRef(target,ir.nodes);const report=computeBlastRadius(ir,id,Number(flagValue(args,'--depth')??'4'));if(args.includes('--json'))return console.log(JSON.stringify(report,null,2));console.log(`IMPACT — ${id}\nAffected ${report.affected}\nRisk     ${report.risk.toUpperCase()} (${report.riskScore}/100)`);for(const row of report.paths)console.log(`${'  '.repeat(row.depth)}↳ ${row.node.id} via ${row.via} [${row.direction}]`);if(report.criticalSubjects.length)console.log(`Critical  ${report.criticalSubjects.join(', ')}`);}

async function element(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const targetRaw=args[0],action=args[1];if(!targetRaw||!action)throw new Error('Usage: senten element <target> <inspect|copy|move|rename|delete> [destination] [--dry-run]');const dryRun=args.includes('--dry-run');const ref=parseElementRef(targetRaw);
  if(!['unknown','file','dir'].includes(ref.kind)){if(action!=='inspect')throw new Error(`Semantic element mutation is delegated to its adapter for ${ref.kind}.`);return explain(cwd,[targetRaw]);}
  const source=resolveElementPath(cwd,ref.id);if(action==='inspect')return inspectFsElement(cwd,source,targetRaw);if(!await exists(source))throw new Error(`Element does not exist: ${targetRaw}`);const destinationArg=args[2]&&!args[2].startsWith('-')?args[2]:undefined;
  let rollback:RollbackRecipe={type:'none',reason:'not assigned'};const targets=[relative(cwd,source)];
  if(action==='copy'){if(!destinationArg)throw new Error('copy requires a destination');const dest=await normalizeDestination(cwd,source,destinationArg);if(await exists(dest))throw new Error(`Refusing to overwrite existing destination: ${relative(cwd,dest)}`);if(!dryRun){await mkdir(dirname(dest),{recursive:true});const info=await stat(source);if(info.isDirectory())await cp(source,dest,{recursive:true,errorOnExist:true});else await copyFile(source,dest);}rollback={type:'delete-created',path:relative(cwd,dest),...(dryRun?{}:{expectedHash:await hashPath(dest)})};targets.push(relative(cwd,dest));}
  else if(action==='move'||action==='rename'){if(!destinationArg)throw new Error(`${action} requires a destination`);const dest=action==='rename'?join(dirname(source),destinationArg):await normalizeDestination(cwd,source,destinationArg);if(await exists(dest))throw new Error(`Refusing to overwrite existing destination: ${relative(cwd,dest)}`);rollback={type:'move',from:relative(cwd,dest),to:relative(cwd,source)};if(!dryRun){await mkdir(dirname(dest),{recursive:true});await rename(source,dest);}targets.push(relative(cwd,dest));}
  else if(action==='delete'){const info=await stat(source);if(info.isDirectory())throw new Error('Directory deletion remains disabled; use a framework-aware operation or remove contents explicitly.');const content=await readFile(source);rollback={type:'restore-file',path:relative(cwd,source),contentBase64:content.toString('base64'),deletedHash:sha256(content)};if(!dryRun)await rm(source);}
  else throw new Error(`Unsupported element action: ${action}`);
  const op=await makeOperation(cwd,{action,intent:`${action} ${targetRaw}`,targets,dryRun,rollback,reversibility:'reversible',actor:actorFlag(args)});await recordOperation(cwd,op);console.log(`${dryRun?'PLANNED':'APPLIED'} ${op.id}\n${action.toUpperCase()} ${targets.join(' -> ')}\nRollback recorded.`);
}

async function history(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const store=await LocalStateStore.open(cwd);const ops=selectOperations(store,args);const rows=ops.map(op=>({...op,currentState:store.currentOperationState(op.id)}));store.close();if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));if(!rows.length)return console.log('No matching Senten operations.');for(const op of rows.slice().reverse())console.log(`${op.id}  ${(op.currentState??'unknown').padEnd(8)} ${op.action.padEnd(8)} ${op.targets.join(' -> ')}  ${op.timestamp}  ${op.actor.type}:${op.actor.id}`);}

async function undo(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const store=await LocalStateStore.open(cwd);try{const first=args.find(a=>!a.startsWith('-'));const isAll=first==='all';let selected:OperationRecord[]=[];
    if(isAll){selected=selectOperations(store,args.filter(a=>a!=='all')).filter(op=>store.currentOperationState(op.id)==='applied').reverse();const plan=await buildUndoPlan(cwd,store,selected);printUndoPlan(plan);if(!args.includes('--apply')){console.log('Preview only. Re-run with --apply to execute this batch rollback.');return;}if(plan.irreversible.length)throw new Error('Batch contains irreversible operations. Narrow the selection or handle them manually.');if(plan.conflicts.length)throw new Error('Batch rollback has conflicts. No changes were applied.');}
    else{const id=first;const op=id?store.getOperation(id):store.latestAppliedOperation(op=>matchesSelectors(op,args));if(!op)throw new Error(id?`Operation not found: ${id}`:'No applied operation is available to undo.');if(store.currentOperationState(op.id)!=='applied')throw new Error(`Operation ${op.id} is not currently applied.`);selected=[op];const conflicts=findLaterConflicts(store,op);if(conflicts.length&&!args.includes('--cascade')){console.log(`UNDO BLOCKED — ${op.id}\nLater applied operations touch the same elements:`);for(const c of conflicts)console.log(`  ${c.id} ${c.action} ${c.targets.join(', ')}`);console.log('Use --cascade to include dependent later operations.');return;}if(conflicts.length&&args.includes('--cascade'))selected=[...conflicts.reverse(),op];if(args.includes('--dry-run')){printUndoPlan(await buildUndoPlan(cwd,store,selected));return;}}
    const actor=actorFlag(args); if(selected.length===1)await undoOne(cwd,store,selected[0]!,actor); else await executeUndoBatch(cwd,store,selected,actor);console.log(`ROLLED BACK ${selected.length} operation${selected.length===1?'':'s'}`);
  } finally {store.close();}
}

async function redo(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const store=await LocalStateStore.open(cwd);try{
    const first=args.find(a=>!a.startsWith('-'));const isAll=first==='all';const actor=actorFlag(args);
    if(isAll){
      const latestBatch=latestUndoBatch(store);let selected:OperationRecord[]=[];let batchId:string|undefined;
      if(latestBatch&&!hasExplicitSelectors(args)){batchId=latestBatch.id;selected=latestBatch.operationIds.map(id=>store.getOperation(id)).filter((v):v is OperationRecord=>Boolean(v)).filter(op=>store.currentOperationState(op.id)==='undone').reverse();}
      else selected=selectOperations(store,args.filter(a=>a!=='all')).filter(op=>store.currentOperationState(op.id)==='undone');
      const plan=await buildRedoPlan(cwd,store,selected);printRedoPlan(plan,batchId);if(!args.includes('--apply')){console.log('Preview only. Re-run with --apply to execute this batch replay.');return;}
      if(plan.conflicts.length||plan.blocked.length)throw new Error('Redo plan has conflicts or blocked operations. No changes were applied.');
      const redoBatchId=`redo_${randomUUID().slice(0,8)}`;const changed:OperationRecord[]=[];
      try{for(const op of selected){await replayOperation(cwd,op);changed.push(op);}}
      catch(error){for(const op of changed.slice().reverse()){if(op.rollback&&op.rollback.type!=='none')await applyRollback(cwd,op.rollback);}throw error;}
      for(const op of selected)store.appendEvent(eventFor('operation.redone',op.id,actor,{replays:op.id,metadata:{redoBatchId,...(batchId?{undoBatchId:batchId}:{})}}));
      console.log(`REDONE ${selected.length} operations${batchId?` from ${batchId}`:''}`);return;
    }
    if(first==='batch')throw new Error('Use: senten redo all [selectors] [--apply] or senten redo <operation-id>.');
    const id=first;const candidates=store.listOperations().filter(op=>store.currentOperationState(op.id)==='undone');const op=id?store.getOperation(id):candidates.at(-1);if(!op||store.currentOperationState(op.id)!=='undone')throw new Error(id?`Operation is not redoable: ${id}`:'No undone operation is available to redo.');
    const plan=await buildRedoPlan(cwd,store,[op]);if(plan.conflicts.length||plan.blocked.length){printRedoPlan(plan);return;}if(args.includes('--dry-run')){printRedoPlan(plan);return;}
    await replayOperation(cwd,op);store.appendEvent(eventFor('operation.redone',op.id,actor,{replays:op.id}));console.log(`REDONE ${op.id}`);
  }finally{store.close();}
}

async function sessionCommand(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const action=args[0]??'list';const store=await LocalStateStore.open(cwd);try{if(action==='start'){const name=args.slice(1).filter(a=>!a.startsWith('--')).join(' ')||'work session';const active=store.get('session.active');if(active)throw new Error(`Session already active: ${active}`);const rec:SessionRecord={id:`ses_${randomUUID().slice(0,8)}`,name,actor:actorFlag(args),startedAt:new Date().toISOString(),status:'active'};store.putSession(rec);store.set('session.active',rec.id);console.log(`SESSION STARTED ${rec.id}\n${rec.name}`);return;}if(action==='end'){const id=store.get('session.active');if(!id)throw new Error('No active session.');const rec=store.getSession(id);if(!rec)throw new Error(`Missing session record: ${id}`);const ended:{endedAt:string;status:'ended'}={endedAt:new Date().toISOString(),status:'ended'};store.putSession({...rec,...ended});store.set('session.active','');console.log(`SESSION ENDED ${id}`);return;}for(const s of store.listSessions().slice().reverse())console.log(`${s.id}  ${s.status.padEnd(6)} ${s.name}  ${s.startedAt}`);}finally{store.close();}}

async function transactionCommand(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const action=args[0];const store=await LocalStateStore.open(cwd);try{if(action==='start'){if(store.get('transaction.active'))throw new Error(`Transaction already active: ${store.get('transaction.active')}`);const name=args.slice(1).filter(a=>!a.startsWith('--')).join(' ')||'transaction';const activeSession=store.get('session.active'); const rec:TransactionRecord={id:`tx_${randomUUID().slice(0,8)}`,name,actor:actorFlag(args),createdAt:new Date().toISOString(),operationIds:[],status:'open',...(activeSession?{sessionId:activeSession}:{})};store.putTransaction(rec);store.set('transaction.active',rec.id);console.log(`TRANSACTION STARTED ${rec.id}`);return;}if(action==='end'){const id=store.get('transaction.active');if(!id)throw new Error('No active transaction.');const rec=store.getTransaction(id);if(!rec)throw new Error(`Missing transaction: ${id}`);store.putTransaction({...rec,status:'closed'});store.set('transaction.active','');console.log(`TRANSACTION ENDED ${id}`);return;}throw new Error('Usage: senten transaction <start|end> [name]');}finally{store.close();}}

async function checkpointCommand(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const action=args[0]??'list';const store=await LocalStateStore.open(cwd);try{if(action==='create'){const name=args[1]??`checkpoint-${Date.now()}`;const branch=gitBranch(cwd); const cp:CheckpointRecord={id:`cp_${randomUUID().slice(0,8)}`,name,createdAt:new Date().toISOString(),actor:actorFlag(args),operationEventCursor:store.eventCount(),...(branch?{branch}:{})};store.putCheckpoint(cp);console.log(`CHECKPOINT ${cp.id}\nName ${cp.name}\nEvent cursor ${cp.operationEventCursor}`);return;}for(const cp of store.listCheckpoints().slice().reverse())console.log(`${cp.id}  ${cp.name}  ${cp.createdAt}`);}finally{store.close();}}

async function rollbackCommand(cwd:string,args:string[]):Promise<void>{const ref=args[0];if(!ref?.startsWith('checkpoint:'))throw new Error('Usage: senten rollback checkpoint:<id> [--apply]');const id=ref.slice('checkpoint:'.length);const store=await LocalStateStore.open(cwd);try{const cp=store.getCheckpoint(id);if(!cp)throw new Error(`Checkpoint not found: ${id}`);const events=store.listEvents();const after=events.slice(cp.operationEventCursor).map(e=>e.operationId);const unique=[...new Set(after)];const ops=unique.map(id=>store.getOperation(id)).filter((v):v is OperationRecord=>Boolean(v)).filter(op=>store.currentOperationState(op.id)==='applied').reverse();const plan=await buildUndoPlan(cwd,store,ops);printUndoPlan(plan);if(!args.includes('--apply')){console.log('Preview only. Re-run with --apply.');return;}if(plan.conflicts.length)throw new Error('Rollback plan contains conflicts; no changes were applied.'); await executeUndoBatch(cwd,store,ops,actorFlag(args));console.log(`ROLLED BACK TO ${cp.id}`);}finally{store.close();}}

async function memoryCommand(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const action=args[0]??'list';if(action==='add'){const kind=(args[1]??'fact') as MemoryKind;const subject=args[2];const value=positionalAfter(args,3).join(' ');if(!subject||!value)throw new Error('Usage: senten memory add <kind> <subject> <value> [--scope project]');return addMemory(cwd,kind,(flagValue(args,'--scope')??'project') as MemoryScope,subject,value,args);}const store=await LocalStateStore.open(cwd);try{const scopeFilter=flagValue(args,'--scope'); const items=store.listMemory(scopeFilter?{scope:scopeFilter}:{});if(args.includes('--json'))return console.log(JSON.stringify(items,null,2));for(const m of items)console.log(`${m.id}  ${m.scope.padEnd(8)} ${m.kind.padEnd(11)} ${(m.subject??'').padEnd(18)} ${m.value}`);}finally{store.close();}}
async function addMemory(cwd:string,kind:MemoryKind,scope:MemoryScope,subject:string,value:string,args:string[]):Promise<void>{const store=await LocalStateStore.open(cwd);try{const service=new MemoryService(store);const config=await loadConfig(cwd);const scopeId=scope==='project'?config.application.id:flagValue(args,'--scope-id');const rec=service.add({kind,scope,...(scopeId?{scopeId}:{}),subject,value,actor:actorFlag(args)});console.log(`MEMORY ADDED ${rec.id}\n${scope}/${kind}/${subject}`);}finally{store.close();}}
async function recallCommand(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const subject=args.filter(a=>!a.startsWith('--')).join(' ');const store=await LocalStateStore.open(cwd);try{const config=await loadConfig(cwd);const activeSession=store.get('session.active'); const scopes:{scope:MemoryScope;scopeId?:string}[]=[{scope:'global'},...(config.profile?[{scope:'profile' as const,scopeId:config.profile}]:[]),{scope:'project',scopeId:config.application.id},...(activeSession?[{scope:'session' as const,scopeId:activeSession}]:[])];let items=new MemoryService(store).resolve(scopes);if(subject)items=items.filter(m=>(m.subject??'').toLowerCase().includes(subject.toLowerCase())||m.value.toLowerCase().includes(subject.toLowerCase()));if(!items.length)return console.log('No matching memory.');for(const m of items)console.log(`${m.scope}/${m.kind}/${m.subject??m.id}: ${m.value}`);}finally{store.close();}}

async function profileCommand(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const action=args[0]??'list';if(action==='create'){if(!args[1])throw new Error('Usage: senten profile create <name>');return createProfile(cwd,args[1],args.slice(2));}const store=await LocalStateStore.open(cwd);try{if(action==='use'){const id=args[1];if(!id||!store.getProfile(id))throw new Error(`Profile not found: ${id??''}`);const config=await loadConfig(cwd);config.profile=id;await saveConfig(cwd,config);console.log(`PROFILE ACTIVE ${id}`);return;}for(const p of store.listProfiles())console.log(`${p.id}  ${p.name}`);}finally{store.close();}}
async function createProfile(cwd:string,name:string,args:string[]):Promise<void>{const store=await LocalStateStore.open(cwd);try{const now=new Date().toISOString();const id=slug(name);const settings:Record<string,unknown>={packageManager:flagValue(args,'--package-manager')??'npm',safeByDefault:true};const p:ProfileRecord={id,name,settings,createdAt:now,updatedAt:now};store.putProfile(p);console.log(`PROFILE CREATED ${id}`);}finally{store.close();}}

async function templateCommand(cwd:string,args:string[],registry:ExtensionRegistry):Promise<void>{await requireInitialized(cwd);const forcedKind=flagValue(args,'--kind');const clean=args.filter((a,i)=>a!=='--kind'&&args[i-1]!=='--kind');const action=clean[0]??'list';if(action==='create'){const name=clean[1];if(!name)throw new Error('Usage: senten template create <name>');return createTemplatePackage(cwd,(forcedKind==='blueprint'?'blueprint':'template'),name,clean.slice(2));}if(action==='list'){const config=await loadConfig(cwd);console.log('LOCAL / REGISTRY');for(const r of config.registries??[]){if(r.type!=='local')continue;for(const e of await new LocalRegistry({...r,location:resolve(cwd,r.location)}).list())if(!forcedKind||e.manifest.kind===forcedKind)console.log(`${r.name}/${e.manifest.name.padEnd(22)} ${e.manifest.kind} ${e.manifest.version}`);}console.log('\nEXTENSIONS');for(const x of registry.templates())if(!forcedKind||x.template.kind===forcedKind)console.log(`${x.namespace}/${x.template.name.padEnd(20)} ${x.template.kind??'template'}  ${x.template.description??''}`);return;}if(action==='inspect'){const name=clean[1];if(!name)throw new Error('Usage: senten template inspect <name|path>');const direct=resolve(cwd,name);if(await exists(join(direct,'senten.package.json')))return console.log(JSON.stringify(await loadPackage(direct),null,2));const found=await findRegistryPackage(cwd,name);if(!found)throw new Error(`Template not found: ${name}`);return console.log(JSON.stringify(found.manifest,null,2));}throw new Error('Usage: senten template <list|create|inspect>');}

async function createWorkflowFile(cwd:string,name:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const dir=join(cwd,'.senten','workflows');await mkdir(dir,{recursive:true});const path=join(dir,`${slug(name)}.json`);if(await exists(path)&&!args.includes('--force'))throw new Error(`Workflow already exists: ${name}. Use --force to replace it.`);
  const empty=args.includes('--empty');
  const definition:WorkflowDefinition={senten:1,kind:'workflow',name:slug(name),version:'0.1.0',description:`Senten workflow ${name}`,onFailure:'stop',inputs:{},steps:empty?[]:[{id:'doctor',command:'doctor'},{id:'inspect',command:'inspect'}],...(empty?{metadata:{draft:true}}:{})};
  await writeWorkflowDefinition(path,definition);console.log(`WORKFLOW CREATED ${definition.name}\nPath ${relative(cwd,path)}\nSteps ${definition.steps.length}${empty?' (draft)':''}\nAdd commands with: senten workflow add ${definition.name} -- <command> [args...]\nInspect with: senten workflow steps ${definition.name}\nPreview with: senten workflow run ${definition.name} --dry-run`);
}

async function writeWorkflowDefinition(path:string,definition:WorkflowDefinition):Promise<void>{
  if(definition.steps.length){validateWorkflow(definition);}else if(definition.metadata?.draft!==true)throw new Error('Workflow requires at least one step unless it is a draft.');
  await writeFile(path,JSON.stringify(definition,null,2)+'\n');
}

async function localWorkflowPath(cwd:string,name:string):Promise<string>{
  const direct=resolve(cwd,name);if(await exists(direct)&&(await stat(direct)).isFile())return direct;
  const path=join(cwd,'.senten','workflows',`${slug(name)}.json`);if(!await exists(path))throw new Error(`Local workflow not found: ${name}`);return path;
}

function workflowCommandTokens(args:string[],start:number):string[]{
  const sep=args.indexOf('--',start);let tokens=sep>=0?args.slice(sep+1):args.slice(start);
  if(tokens.length===1&&tokens[0]!.includes(' '))tokens=tokens[0]!.trim().split(/\s+/);
  return tokens;
}

function workflowStepId(command:string,index:number):string{return `${slug(command)}-${index+1}`;}

async function workflowCommand(cwd:string,args:string[],registry:ExtensionRegistry):Promise<void>{
  await requireInitialized(cwd);const action=args[0]??'list';
  if(action==='create'){const name=args[1];if(!name)throw new Error('Usage: senten workflow create <name> [--empty]');return createWorkflowFile(cwd,name,args.slice(2));}
  if(['add','remove','move','clear','steps','validate'].includes(action)){
    const name=args[1];if(!name)throw new Error(`Usage: senten workflow ${action} <name> ...`);const path=await localWorkflowPath(cwd,name);const definition=JSON.parse(await readFile(path,'utf8')) as WorkflowDefinition;
    if(action==='add'){
      const tokens=workflowCommandTokens(args,2);if(!tokens.length)throw new Error(`Usage: senten workflow add ${name} -- <command> [args...]`);const command=tokens[0]!;const commandArgs=tokens.slice(1);const available=(CORE_COMMANDS as readonly string[]).includes(command)||Boolean(registry.get(command));if(!available)throw new Error(`Unknown workflow command namespace: ${command}. Run: senten commands --format json`);
      const next={...definition,steps:[...definition.steps,{id:workflowStepId(command,definition.steps.length),command,...(commandArgs.length?{args:commandArgs}:{})}],metadata:{...(definition.metadata??{}),draft:false}};await writeWorkflowDefinition(path,next);console.log(`WORKFLOW STEP ADDED ${name}\n${next.steps.length}. senten ${command}${commandArgs.length?` ${commandArgs.join(' ')}`:''}`);return;
    }
    if(action==='remove'){
      const raw=args[2];const index=Number(raw)-1;if(!raw||!Number.isInteger(index)||index<0||index>=definition.steps.length)throw new Error(`Usage: senten workflow remove ${name} <step-number>`);const steps=definition.steps.filter((_,i)=>i!==index).map((step,i)=>({...step,id:step.id??workflowStepId(step.command??step.workflow??'step',i)}));const next={...definition,steps,metadata:{...(definition.metadata??{}),draft:steps.length===0}};await writeWorkflowDefinition(path,next);console.log(`WORKFLOW STEP REMOVED ${name}\nRemaining ${steps.length}`);return;
    }
    if(action==='move'){
      const from=Number(args[2])-1,to=Number(args[3])-1;if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=definition.steps.length||to>=definition.steps.length)throw new Error(`Usage: senten workflow move ${name} <from-step> <to-step>`);const steps=[...definition.steps];const [step]=steps.splice(from,1);steps.splice(to,0,step!);await writeWorkflowDefinition(path,{...definition,steps});console.log(`WORKFLOW STEP MOVED ${name} ${from+1} -> ${to+1}`);return;
    }
    if(action==='clear'){const next={...definition,steps:[],metadata:{...(definition.metadata??{}),draft:true}};await writeWorkflowDefinition(path,next);console.log(`WORKFLOW CLEARED ${name}\nDraft is empty. Add commands with: senten workflow add ${name} -- <command> [args...]`);return;}
    if(action==='steps'){
      console.log(`WORKFLOW STEPS — ${definition.name}`);if(!definition.steps.length){console.log('No steps.');return;}definition.steps.forEach((step,i)=>console.log(`${String(i+1).padStart(2)}  ${step.workflow?`workflow ${step.workflow}`:`senten ${step.command} ${(step.args??[]).join(' ')}`.trim()}${step.if?`  if=${step.if}`:''}${step.onFailure?`  onFailure=${step.onFailure}`:''}`));return;
    }
    if(action==='validate'){
      const errors:string[]=[];if(!definition.steps.length)errors.push('Workflow has no steps.');else{try{validateWorkflow(definition);}catch(error){errors.push(error instanceof Error?error.message:String(error));}for(const [i,step] of definition.steps.entries()){if(step.command){const available=(CORE_COMMANDS as readonly string[]).includes(step.command)||Boolean(registry.get(step.command));if(!available)errors.push(`Step ${i+1}: command namespace not available: ${step.command}`);}}}
      if(errors.length){console.log(`WORKFLOW VALIDATION FAIL — ${definition.name}`);for(const error of errors)console.log(`  ✕ ${error}`);process.exitCode=1;return;}console.log(`WORKFLOW VALIDATION PASS — ${definition.name}\nSteps ${definition.steps.length}`);return;
    }
  }
  if(action==='list'){const local=join(cwd,'.senten','workflows');if(await exists(local))for(const file of (await readdir(local)).filter(x=>x.endsWith('.json')).sort()){try{const path=join(local,file);const raw=JSON.parse(await readFile(path,'utf8')) as WorkflowDefinition;if(!raw.steps.length&&raw.metadata?.draft===true)console.log(`${raw.name.padEnd(24)} ${raw.version}  DRAFT`);else{validateWorkflow(raw);console.log(`${raw.name.padEnd(24)} ${raw.version}  ${raw.description??''}`);}}catch{console.log(`${file.padEnd(24)} INVALID`);}}const config=await loadConfig(cwd);for(const r of config.registries??[]){if(r.type!=='local')continue;for(const e of await new LocalRegistry({...r,location:resolve(cwd,r.location)}).list())if(e.manifest.kind==='workflow')console.log(`${r.name}/${e.manifest.name.padEnd(18)} ${e.manifest.version}  registry`);}return;}
  if(action==='inspect'){const name=args[1];if(!name)throw new Error('Usage: senten workflow inspect <name|run-id>');const store=await LocalStateStore.open(cwd);try{const run=store.getWorkflowRun(name);if(run){console.log(JSON.stringify(run,null,2));return;}}finally{store.close();}const local=join(cwd,'.senten','workflows',`${slug(name)}.json`);if(await exists(local)){console.log(await readFile(local,'utf8'));return;}const resolved=await resolveWorkflow(cwd,name);console.log(JSON.stringify(resolved.definition,null,2));return;}
  if(action==='history'){const name=args[1]&&!args[1].startsWith('-')?args[1]:undefined;const store=await LocalStateStore.open(cwd);try{const rows=store.listWorkflowRuns(name).slice().reverse();if(args.includes('--json')){console.log(JSON.stringify(rows,null,2));return;}if(!rows.length){console.log('No workflow runs.');return;}for(const run of rows)console.log(`${run.id}  ${run.status.padEnd(11)} ${run.workflow.padEnd(22)} ${run.startedAt}  ${run.actor.type}:${run.actor.id}`);return;}finally{store.close();}}
  if(action==='package'){const name=args[1];if(!name)throw new Error('Usage: senten workflow package <name>');const resolved=await resolveWorkflow(cwd,name);const root=join(cwd,'.senten','packages',`workflow-${slug(resolved.definition.name)}`);await rm(root,{recursive:true,force:true});await mkdir(join(root,'payload'),{recursive:true});const text=JSON.stringify(resolved.definition,null,2)+'\n';await writeFile(join(root,'payload','workflow.json'),text);const digest=sha256(text);const manifest={senten:1 as const,kind:'workflow' as const,name:resolved.definition.name,version:resolved.definition.version,description:resolved.definition.description,files:['workflow.json'],integrity:{algorithm:'sha256' as const,files:{'workflow.json':digest},packageDigest:sha256(`workflow.json:${digest}`)},compatibility:{senten:'>=0.8.0 <1.0.0',node:'>=22.5.0'},metadata:{source:'senten-workflow'}};await writeFile(join(root,'senten.package.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`WORKFLOW PACKAGE ${manifest.name}@${manifest.version}\nPath ${relative(cwd,root)}`);return;}
  if(action==='install'){const name=args[1];if(!name)throw new Error('Usage: senten workflow install <registry/name|name>');const resolved=await resolveWorkflow(cwd,name);const dir=join(cwd,'.senten','workflows');await mkdir(dir,{recursive:true});const path=join(dir,`${slug(resolved.definition.name)}.json`);if(await exists(path)&&!args.includes('--force'))throw new Error(`Workflow already installed: ${resolved.definition.name}. Use --force to replace.`);await writeFile(path,JSON.stringify(resolved.definition,null,2)+'\n');console.log(`WORKFLOW INSTALLED ${resolved.definition.name}`);return;}
  if(action==='run'){const name=args[1];if(!name)throw new Error('Usage: senten workflow run <name> [--input key=value] [--dry-run]');return runWorkflow(cwd,name,args.slice(2),registry);}
  throw new Error('Usage: senten workflow <list|create|add|remove|move|clear|steps|validate|inspect|run|history|package|install>');
}

async function resolveWorkflow(cwd:string,name:string):Promise<{definition:WorkflowDefinition;source:string}>{
  const localCandidates=[resolve(cwd,name),join(cwd,'.senten','workflows',`${slug(name)}.json`)];for(const path of localCandidates)if(await exists(path)&&(await stat(path)).isFile())return{definition:await loadWorkflow(path),source:path};
  const config=await loadConfig(cwd);const [registryPrefix,packageName]=name.includes('/')?name.split('/',2):[undefined,name];for(const r of config.registries??[]){if(r.type!=='local'||(registryPrefix&&r.name!==registryPrefix))continue;const entry=await new LocalRegistry({...r,location:resolve(cwd,r.location)}).find(packageName!,'workflow');if(entry){const check=await verifyPackage(entry.path);if(!check.ok)throw new Error(`Workflow package verification failed: ${check.errors.join('; ')}`);const path=join(entry.path,'payload','workflow.json');return{definition:await loadWorkflow(path),source:path};}}
  throw new Error(`Workflow not found: ${name}`);
}

function workflowInputsFromArgs(definition:WorkflowDefinition,args:string[]):Record<string,string>{
  const provided:Record<string,string>={};for(let i=0;i<args.length;i++){const arg=args[i]!;if(arg==='--input'&&args[i+1]){const [k,...rest]=args[++i]!.split('=');if(k)provided[k]=rest.join('=');continue;}if(arg.startsWith('--')&&!['--dry-run','--json','--apply'].includes(arg)){const key=arg.slice(2),next=args[i+1];if(next&&!next.startsWith('--')){provided[key]=next;i++;}}}return resolveWorkflowInputs(definition,provided);
}

async function runWorkflow(cwd:string,name:string,args:string[],registry:ExtensionRegistry):Promise<void>{
  const local=join(cwd,'.senten','workflows',`${slug(name)}.json`);let resolved:{definition:WorkflowDefinition;source:string};if(await exists(local)){const definition=JSON.parse(await readFile(local,'utf8')) as WorkflowDefinition;resolved={definition,source:local};}else resolved=await resolveWorkflow(cwd,name);const definition=resolved.definition;if(!definition.steps.length)throw new Error(`Workflow ${definition.name} has no steps. Add one with: senten workflow add ${definition.name} -- <command> [args...]`);validateWorkflow(definition);const inputs=workflowInputsFromArgs(definition,args);const dryRun=args.includes('--dry-run');const actor=actorFlag(args);const store=await LocalStateStore.open(cwd);const beforeIds=new Set(store.listOperations().map(op=>op.id));const run:WorkflowRunRecord={id:`wf_${randomUUID().slice(0,8)}`,workflow:definition.name,version:definition.version,actor,startedAt:new Date().toISOString(),status:dryRun?'planned':'running',inputs,dryRun,operationEventCursor:store.eventCount(),operationIds:[],steps:[]};store.putWorkflowRun(run);store.close();
  if(dryRun){console.log(`WORKFLOW PLAN — ${definition.name}\nRun ${run.id}`);for(const line of workflowPlan(definition,inputs))console.log(`  ${line}`);}
  const result=await executeWorkflow({definition,inputs,dryRun,execute:async(command,stepArgs)=>{if(command==='workflow')throw new Error('Use the workflow field for nested workflows, not command: workflow.');await main([command,...stepArgs]);},runNested:async(nested,nestedInputs,nestedDry)=>{const nestedArgs=Object.entries(nestedInputs).flatMap(([k,v])=>['--input',`${k}=${v}`]);if(nestedDry)nestedArgs.push('--dry-run');await runWorkflow(cwd,nested,nestedArgs,registry);},rollback:async()=>{const rollbackStore=await LocalStateStore.open(cwd);try{const created=rollbackStore.listOperations().filter(op=>!beforeIds.has(op.id)&&rollbackStore.currentOperationState(op.id)==='applied').reverse();if(created.length)await executeUndoBatch(cwd,rollbackStore,created,actor);}finally{rollbackStore.close();}}},run);
  const finalStore=await LocalStateStore.open(cwd);try{const after=finalStore.listOperations().filter(op=>!beforeIds.has(op.id));const final={...result,operationIds:after.map(op=>op.id)};finalStore.putWorkflowRun(final);if(!dryRun){console.log(`WORKFLOW ${final.status.toUpperCase()} ${final.id}\nSteps ${final.steps.filter(s=>s.status==='passed').length}/${final.steps.length}\nOperations ${final.operationIds.length}`);for(const step of final.steps)console.log(`  ${step.status.padEnd(7)} ${step.id}  ${step.command}${step.error?` — ${step.error}`:''}`);}if(final.status==='failed')process.exitCode=1;}finally{finalStore.close();}
}

async function registryCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const action=args[0]??'list';const config=await loadConfig(cwd);config.registries??=[];
  if(action==='add'){
    const name=args[1],location=args[2];if(!name||!location)throw new Error('Usage: senten registry add <name> <path-or-url> [--trusted]');
    if(config.registries.some(r=>r.name===name))throw new Error(`Registry already exists: ${name}`);
    const type=/^https?:\/\//i.test(location)?'http':'local';config.registries.push({name,type,location,...(args.includes('--trusted')?{trusted:true}:{})});await saveConfig(cwd,config);console.log(`REGISTRY ADDED ${name} [${type}] -> ${location}`);return;
  }
  if(action==='search'){
    const query=(args[1]??'').toLowerCase();for(const r of config.registries){try{const provider=r.type==='local'?new LocalRegistry({...r,location:resolve(cwd,r.location)}):new HttpRegistry(r);for(const e of await provider.list())if(!query||e.manifest.name.toLowerCase().includes(query)||e.manifest.kind.toLowerCase().includes(query)||e.manifest.publisher?.toLowerCase().includes(query))console.log(`${r.name}/${e.manifest.name}  ${e.manifest.kind} ${e.manifest.version}${e.manifest.publisher?`  ${e.manifest.publisher}`:''}`);}catch(error){console.error(`! ${r.name}: ${error instanceof Error?error.message:String(error)}`);}}return;
  }
  if(action==='fetch'){
    const name=args[1];if(!name)throw new Error('Usage: senten registry fetch <registry/name|name>');const entry=await resolveRegistryEntry(cwd,name);const root=await materializeRegistryEntry(cwd,entry);console.log(`FETCHED ${entry.manifest.kind}:${entry.manifest.name}@${entry.manifest.version}\nRegistry ${entry.registry}\nPath ${relative(cwd,root)}`);return;
  }
  if(action==='publish'){
    const packagePath=args[1],registryName=flagValue(args,'--to')??'local';if(!packagePath)throw new Error('Usage: senten registry publish <package-path> [--to registry]');const target=config.registries.find(r=>r.name===registryName);if(!target)throw new Error(`Registry not configured: ${registryName}`);if(target.type!=='local')throw new Error('HTTP registries are read-only in v0.8. Publish by generating/updating the registry index on its host.');
    const verification=await verifyPackage(resolve(cwd,packagePath));if(!verification.ok)throw new Error(`Package verification failed: ${verification.errors.join('; ')}`);const compatibility=checkCompatibility(verification.manifest,VERSION);if(!compatibility.ok)throw new Error(`Package compatibility failed: ${compatibility.reasons.join('; ')}`);const entry=await new LocalRegistry({...target,location:resolve(cwd,target.location)}).publish(resolve(cwd,packagePath));console.log(`PUBLISHED ${entry.manifest.kind}:${entry.manifest.name}@${entry.manifest.version} -> ${registryName}`);return;
  }
  for(const r of config.registries)console.log(`${r.name.padEnd(12)} ${r.type.padEnd(6)} ${r.location}${r.trusted?'  trusted':''}`);
}

async function resolveRegistryEntry(cwd:string,name:string,kind?:string):Promise<RegistryEntry>{
  const config=await loadConfig(cwd);const [prefix,packageName]=name.includes('/')?name.split('/',2):[undefined,name];
  for(const r of config.registries??[]){if(prefix&&r.name!==prefix)continue;const provider=r.type==='local'?new LocalRegistry({...r,location:resolve(cwd,r.location)}):new HttpRegistry(r);const found=await provider.find(packageName!,kind);if(found)return found;}
  throw new Error(`Package not found in configured registries: ${name}`);
}
async function materializeRegistryEntry(cwd:string,entry:RegistryEntry):Promise<string>{
  if(!entry.remote)return entry.path;
  const config=await loadConfig(cwd);const r=config.registries?.find(x=>x.name===entry.registry);if(!r||r.type!=='http')throw new Error(`HTTP registry not configured: ${entry.registry}`);
  const dest=join(cwd,'.senten','cache','registry',entry.registry,`${entry.manifest.kind}-${entry.manifest.name}-${entry.manifest.version}`);return new HttpRegistry(r).fetchPackage(entry,dest);
}

async function packageCommand(cwd:string,args:string[]):Promise<void>{
  const action=args[0]??'inspect';
  if(action==='keygen')return trustCommand(cwd,['keygen',...args.slice(1)]);
  if(action==='install'){
    await requireInitialized(cwd);const name=args[1];if(!name)throw new Error('Usage: senten package install <registry/name|name> [--allow-untrusted]');const entry=await resolveRegistryEntry(cwd,name);const root=await materializeRegistryEntry(cwd,entry);const result=await verifyPackage(root);if(!result.ok)throw new Error(`Package integrity failed: ${result.errors.join('; ')}`);
    const compatibility=checkCompatibility(result.manifest,VERSION);if(!compatibility.ok)throw new Error(`Package compatibility failed: ${compatibility.reasons.join('; ')}`);
    const trust=await loadTrustStore(cwd);const signatures=verifyManifestSignatures(result.manifest,trust);const configured=(await loadConfig(cwd)).registries?.find(r=>r.name===entry.registry);const trusted=signatures.trusted.length>0||Boolean(configured?.trusted);
    if(!trusted&&!args.includes('--allow-untrusted'))throw new Error(`Package is not trusted. Valid signatures: ${signatures.valid.length}; trusted signatures: ${signatures.trusted.length}. Review with senten package verify and use --allow-untrusted only if intentional.`);
    const dest=join(cwd,'.senten','packages','installed',`${result.manifest.kind}-${result.manifest.name}-${result.manifest.version}`);await rm(dest,{recursive:true,force:true});await mkdir(dirname(dest),{recursive:true});await cp(root,dest,{recursive:true});console.log(`INSTALLED ${result.manifest.kind}:${result.manifest.name}@${result.manifest.version}\nTrust ${trusted?'trusted':'explicitly allowed'}\nPath ${relative(cwd,dest)}`);return;
  }
  const path=args[1];if(!path)throw new Error('Usage: senten package <inspect|verify|sign|install> <path-or-package>');const root=resolve(cwd,path);
  if(action==='inspect'){console.log(JSON.stringify(await loadPackage(root),null,2));return;}
  if(action==='sign'){const key=flagValue(args,'--key');if(!key)throw new Error('Usage: senten package sign <path> --key <private.pem> [--publisher name]');const manifest=await signPackageManifest(root,resolve(cwd,key),flagValue(args,'--publisher'));console.log(`SIGNED ${manifest.kind}:${manifest.name}@${manifest.version}\nPublisher ${manifest.publisher??'-'}\nSignatures ${manifest.signatures?.length??0}`);return;}
  if(action==='verify'){
    const result=await verifyPackage(root);const compatibility=checkCompatibility(result.manifest,VERSION);const trust=await loadTrustStore(cwd);const signatures=verifyManifestSignatures(result.manifest,trust);const ok=result.ok&&compatibility.ok&&signatures.errors.length===0;
    console.log(`PACKAGE VERIFY ${ok?'PASS':'FAIL'}\n${result.manifest.kind}:${result.manifest.name}@${result.manifest.version}\nIntegrity     ${result.ok?'pass':'fail'}\nCompatibility ${compatibility.ok?'pass':'fail'}\nSignatures    ${signatures.valid.length} valid / ${signatures.trusted.length} trusted`);for(const error of [...result.errors,...compatibility.reasons,...signatures.errors])console.log(`  ! ${error}`);if(!ok)process.exitCode=1;return;
  }
  throw new Error('Usage: senten package <inspect|verify|sign|install> <path-or-package>');
}

async function trustCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const action=args[0]??'list';
  if(action==='keygen'){const out=flagValue(args,'--out')??join(cwd,'.senten','keys');const publisher=flagValue(args,'--publisher')??'local';const key=await generateSigningKey(resolve(cwd,out),publisher);console.log(`SIGNING KEY CREATED\nKey ID  ${key.keyId}\nPrivate ${relative(cwd,key.privateKeyPath)}\nPublic  ${relative(cwd,key.publicKeyPath)}\nKeep the private key secret.`);return;}
  if(action==='add'){const key=args[1];if(!key)throw new Error('Usage: senten trust add <public.pem> [--publisher name]');const record=await trustPublicKey(cwd,resolve(cwd,key),flagValue(args,'--publisher'));console.log(`TRUSTED ${record.keyId}${record.publisher?` publisher=${record.publisher}`:''}`);return;}
  const store=await loadTrustStore(cwd);if(!store.keys.length){console.log('No trusted publisher keys.');return;}for(const k of store.keys)console.log(`${k.keyId}  ${(k.publisher??'-').padEnd(18)} ${k.source??''}`);
}

async function cacheCommand(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const action=args[0]??'status';const path=join(cwd,'.senten','cache');if(action==='clear'){await rm(path,{recursive:true,force:true});await mkdir(path,{recursive:true});console.log('CACHE CLEARED');return;}const size=await dirSize(path);console.log(`CACHE\nPath   ${relative(cwd,path)}\nSize   ${size} bytes\nRule   disposable / rebuildable`);}

async function extensions(registry:ExtensionRegistry,args:string[]):Promise<void>{const action=args[0];const rows=registry.list();if(action==='audit'){const { validateSentenExtension }=await import('../../extension-sdk/src/index.js');let failures=0;for(const ext of rows){const result=validateSentenExtension(ext);if(!result.ok)failures++;console.log(`${result.ok?'PASS':'FAIL'} ${ext.namespace}@${ext.version} capabilities=${ext.capabilities.join(',')||'-'}${result.warnings.length?` warnings=${result.warnings.length}`:''}`);}if(failures)process.exitCode=1;return;}if(action==='inspect'||action==='validate'){const ns=args[1];if(!ns)throw new Error(`Usage: senten extensions ${action} <namespace>`);const ext=registry.get(ns);if(!ext)throw new Error(`Extension not found: ${ns}`);if(action==='inspect')return console.log(JSON.stringify(ext,null,2));const { validateSentenExtension }=await import('../../extension-sdk/src/index.js');const result=validateSentenExtension(ext);console.log(`EXTENSION VALIDATE ${result.ok?'PASS':'FAIL'}\n${ext.namespace}@${ext.version}\nSenten ${ext.senten}\nCapabilities ${ext.capabilities.join(', ')||'-'}`);for(const e of result.errors)console.log(`  ! ${e}`);for(const w of result.warnings)console.log(`  ~ ${w}`);if(!result.ok)process.exitCode=1;return;}if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));for(const ext of rows)console.log(`${ext.namespace.padEnd(14)} ${ext.kind.padEnd(11)} ${ext.version}  ${ext.name}`);}
async function runExtension(registry:ExtensionRegistry,namespace:string,cwd:string,args:string[]):Promise<void>{const path=args[0]??'';const command=registry.command(namespace,path);if(!command){const ext=registry.get(namespace)!;console.log(`${ext.name} (${ext.version})`);for(const cmd of ext.commands??[])console.log(`  senten ${namespace} ${cmd.path.padEnd(14)} ${cmd.description}`);return;}const code=await command.run({cwd,args:args.slice(1),flags:parseFlags(args.slice(1))});if(typeof code==='number')process.exitCode=code;}
async function sandbox(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);
  const action=args[0]??'list';
  const store=await LocalStateStore.open(cwd);
  try{
    await expireSandboxes(store);
    if(action==='providers'){
      const local=new LocalSandboxProvider(),docker=new DockerSandboxProvider();
      console.log(`SANDBOX PROVIDERS
local   ${(await local.available())?'available':'unavailable'}  workspace-copy (not a security boundary)
docker  ${(await docker.available())?'available':'unavailable'}  container isolation / enforceable network deny`);return;
    }
    if(action==='create'){
      const flags=parseFlags(args.slice(1));
      const provider=(String(flags.provider??'local')) as SandboxProviderKind;
      if(!['local','docker'].includes(provider))throw new Error('Sandbox provider must be local or docker.');
      const network=String(flags.network??(provider==='docker'?'deny':'inherit')) as 'inherit'|'deny';
      if(!['inherit','deny'].includes(network))throw new Error('Sandbox network policy must be inherit or deny.');
      const ttl=parseDurationMs(typeof flags.ttl==='string'?flags.ttl:undefined);
      const timeoutMs=parseDurationMs(typeof flags.timeout==='string'?flags.timeout:undefined);
      const syntheticSecrets=multiFlagValues(args,'--synthetic-secret');
      const budget={timeoutMs,maxOutputBytes:typeof flags['max-output']==='string'?parseSize(flags['max-output']):undefined,memoryMb:typeof flags.memory==='string'?Number(flags.memory):undefined,cpus:typeof flags.cpus==='string'?Number(flags.cpus):undefined,pids:typeof flags.pids==='string'?Number(flags.pids):undefined};
      const p=await providerFor(provider);
      const handle=await p.create({projectRoot:cwd,provider,network,environmentName:typeof flags.env==='string'?flags.env:'sandbox',ttlMs:ttl,syntheticSecrets,budget,dockerImage:typeof flags.image==='string'?flags.image:undefined,copyProject:true,metadata:{createdBy:`${actorFlag(args).type}:${actorFlag(args).id}`}});
      store.putSandbox(handle.record);
      console.log(`SANDBOX CREATED ${handle.record.id}
Provider   ${handle.record.provider}
Isolation  ${handle.record.isolation}
Network    ${handle.record.network}
Root       ${relative(cwd,handle.record.root)}
Expires    ${handle.record.expiresAt??'manual'}
Secrets    ${(handle.record.syntheticSecretNames??[]).join(', ')||'none'}`);
      if(handle.record.provider==='local')console.log('Note       Local workspace isolation is for reproducibility, not untrusted-code containment.');
      return;
    }
    if(action==='list'){
      const rows=store.listSandboxes();
      if(args.includes('--json')){console.log(JSON.stringify(rows,null,2));return;}
      if(!rows.length){console.log('No sandboxes.');return;}
      for(const sbx of rows)console.log(`${sbx.id.padEnd(14)} ${sbx.status.padEnd(10)} ${sbx.provider.padEnd(7)} ${sbx.network.padEnd(7)} ${sbx.environmentName}${sbx.expiresAt?`  expires ${sbx.expiresAt}`:''}`);
      return;
    }
    if(action==='inspect'){
      const id=args[1];if(!id)throw new Error('Usage: senten sandbox inspect <id>');const sbx=store.getSandbox(id);if(!sbx)throw new Error(`Sandbox not found: ${id}`);const digest=sbx.status==='active'&&await exists(sbx.root)?await workspaceDigest(sbx.root):undefined;
      console.log(JSON.stringify({...sbx,workspaceDigest:digest,runs:store.listSandboxRuns(id).length,snapshots:store.listSandboxSnapshots(id).length},null,2));return;
    }
    if(action==='run'){
      const id=args[1];if(!id)throw new Error('Usage: senten sandbox run <id> -- <command> [args...]');const sbx=store.getSandbox(id);if(!sbx||sbx.status!=='active')throw new Error(`Active sandbox not found: ${id}`);
      const separator=args.indexOf('--');if(separator<0||!args[separator+1]){const suspicious=args.slice(2).find(a=>a.startsWith('--')&&a!=='--');const hint=suspicious?`\n\nIt looks like you may be missing the command separator. Example:\n  senten sandbox run ${id} -- node --version\n\nThe standalone -- separates Senten options from the command executed inside the sandbox.`:'';throw new Error(`Usage: senten sandbox run <id> -- <command> [args...]${hint}`);}
      const command=args[separator+1]!,commandArgs=args.slice(separator+2);const options=args.slice(2,separator);const cwdFlag=flagValue(options,'--cwd');const timeout=parseDurationMs(flagValue(options,'--timeout'));const maxOutputValue=flagValue(options,'--max-output');const envEntries=multiFlagValues(options,'--env');const env:Record<string,string>={};for(const entry of envEntries){const [key,...rest]=entry.split('=');if(!key||!rest.length)throw new Error(`Invalid --env value: ${entry}`);env[key]=rest.join('=');}
      const runSpec={command,args:commandArgs,cwd:cwdFlag,env,timeoutMs:timeout,maxOutputBytes:maxOutputValue?parseSize(maxOutputValue):undefined,effectIntent:options.includes('--include-actions')?'mutating' as const:'read-only' as const,allowLiveEffects:options.includes('--allow-live-effects')};const boundary=assertSandboxEffectBoundary(sbx,runSpec);
      const snapshot=await createSnapshot(sbx,join(cwd,'.senten','snapshots'),`before ${command}`);store.putSandboxSnapshot(snapshot);const before=await workspaceDigest(sbx.root);const p=await providerFor(sbx.provider);const handle=await p.open(sbx);const result=await handle.run(runSpec);const after=await workspaceDigest(sbx.root);const run=createSandboxRunRecord(sbx,runSpec,result,snapshot.id,before,after,{effectIntent:runSpec.effectIntent,effectBoundary:boundary.mode,effectBoundaryReason:boundary.reason,liveEffectsAllowed:runSpec.allowLiveEffects});store.putSandboxRun(run);
      console.log(`SANDBOX RUN ${run.id}\nExit       ${result.code}\nDuration   ${result.durationMs}ms\nTimed out  ${result.timedOut?'yes':'no'}\nChanged    ${before===after?'no':'yes'}\nEffects    ${boundary.mode}\nSnapshot   ${snapshot.id}`);
      if(result.stdout)process.stdout.write(result.stdout+(result.stdout.endsWith('\n')?'':'\n'));
      if(result.stderr)process.stderr.write(result.stderr+(result.stderr.endsWith('\n')?'':'\n'));
      if(result.truncated)console.log('[output truncated]');
      if(result.code!==0)process.exitCode=result.code||1;
      return;
    }
    if(action==='runs'){
      const id=args[1];for(const run of store.listSandboxRuns(id))console.log(`${run.id.padEnd(14)} ${run.sandboxId.padEnd(14)} exit=${String(run.code).padEnd(4)} ${run.command} ${run.args.join(' ')}`);return;
    }
    if(action==='snapshot'){
      const id=args[1];if(!id)throw new Error('Usage: senten sandbox snapshot <id> [name]');const sbx=store.getSandbox(id);if(!sbx||sbx.status!=='active')throw new Error(`Active sandbox not found: ${id}`);const snapshot=await createSnapshot(sbx,join(cwd,'.senten','snapshots'),args[2]);store.putSandboxSnapshot(snapshot);console.log(`SNAPSHOT ${snapshot.id}
Sandbox  ${id}
Digest   ${snapshot.workspaceDigest}
Root     ${relative(cwd,snapshot.root)}`);return;
    }
    if(action==='snapshots'){
      const id=args[1];for(const snap of store.listSandboxSnapshots(id))console.log(`${snap.id.padEnd(14)} ${snap.sandboxId.padEnd(14)} ${snap.workspaceDigest.slice(0,12)}  ${snap.name??''}`);return;
    }
    if(action==='restore'){
      const id=args[1],snapshotId=args[2];if(!id||!snapshotId)throw new Error('Usage: senten sandbox restore <id> <snapshot-id>');const sbx=store.getSandbox(id);const snap=store.getSandboxSnapshot(snapshotId);if(!sbx||sbx.status!=='active')throw new Error(`Active sandbox not found: ${id}`);if(!snap)throw new Error(`Snapshot not found: ${snapshotId}`);if(snap.sandboxId!==id&&!args.includes('--force'))throw new Error('Snapshot belongs to another sandbox. Use --force only when intentional.');await restoreSnapshot(snap,sbx.root);console.log(`SANDBOX RESTORED ${id} <- ${snapshotId}`);return;
    }
    if(action==='reproduce'){
      const runId=args[1];if(!runId)throw new Error('Usage: senten sandbox reproduce <run-id>');const original=store.getSandboxRun(runId);if(!original)throw new Error(`Sandbox run not found: ${runId}`);if(!original.preSnapshotId)throw new Error(`Run ${runId} has no pre-run snapshot.`);const snap=store.getSandboxSnapshot(original.preSnapshotId);if(!snap)throw new Error(`Snapshot missing: ${original.preSnapshotId}`);const originalSandbox=store.getSandbox(original.sandboxId);if(!originalSandbox)throw new Error(`Original sandbox missing: ${original.sandboxId}`);const p=await providerFor(original.provider);const handle=await p.create({projectRoot:cwd,provider:original.provider,network:originalSandbox.network,environmentName:originalSandbox.environmentName,copyProject:false,budget:originalSandbox.budget,dockerImage:originalSandbox.dockerImage,metadata:{reproducedFrom:runId}});await restoreSnapshot(snap,handle.record.root);store.putSandbox(handle.record);const result=await handle.run({command:original.command,args:original.args,cwd:original.cwd});const after=await workspaceDigest(handle.record.root);const reproduced={...createSandboxRunRecord(handle.record,{command:original.command,args:original.args,cwd:original.cwd},result,snap.id,snap.workspaceDigest,after),reproducedFrom:runId};store.putSandboxRun(reproduced);console.log(`REPRODUCED ${runId} -> ${reproduced.id}
Sandbox       ${handle.record.id}
Original exit ${original.code}
Replayed exit ${result.code}
Workspace     ${snap.workspaceDigest===reproduced.workspaceDigestBefore?'matched':'different'}`);if(result.code!==0)process.exitCode=result.code||1;return;
    }
    if(action==='destroy'){
      const id=args[1];if(!id)throw new Error('Usage: senten sandbox destroy <id>');const sbx=store.getSandbox(id);if(!sbx)throw new Error(`Sandbox not found: ${id}`);if(sbx.status==='destroyed'){console.log(`Sandbox ${id} is already destroyed.`);return;}const p=await providerFor(sbx.provider);const handle=await p.open(sbx);await handle.destroy();store.putSandbox({...sbx,status:'destroyed'});console.log(`SANDBOX DESTROYED ${id}`);return;
    }
    if(action==='simulate-install'){
      const packageName=args[1];if(!packageName)throw new Error('Usage: senten sandbox simulate-install <package> [--provider docker] [--allow-scripts]');const provider=(flagValue(args,'--provider')??'local') as SandboxProviderKind;const p=await providerFor(provider);const handle=await p.create({projectRoot:cwd,provider,network:'inherit',environmentName:'package-simulation',copyProject:true,budget:{timeoutMs:parseDurationMs(flagValue(args,'--timeout'))??120_000,maxOutputBytes:200_000}});store.putSandbox(handle.record);const before=await workspaceDigest(handle.record.root);const installArgs=['install',packageName];if(!args.includes('--allow-scripts'))installArgs.push('--ignore-scripts');const result=await handle.run({command:'npm',args:installArgs});const after=await workspaceDigest(handle.record.root);const run=createSandboxRunRecord(handle.record,{command:'npm',args:installArgs},result,undefined,before,after);store.putSandboxRun(run);console.log(`PACKAGE INSTALL SIMULATION
Package   ${packageName}
Sandbox   ${handle.record.id}
Provider  ${provider}
Scripts   ${args.includes('--allow-scripts')?'allowed':'blocked (--ignore-scripts)'}
Exit      ${result.code}
Changed   ${before===after?'no':'yes'}`);if(result.stdout)process.stdout.write(`
${result.stdout}`);if(result.stderr)process.stderr.write(`
${result.stderr}`);console.log(`
Review with: senten sandbox inspect ${handle.record.id}
Destroy with: senten sandbox destroy ${handle.record.id}`);if(result.code!==0)process.exitCode=result.code||1;return;
    }
    throw new Error('Usage: senten sandbox <providers|create|list|inspect|run|runs|snapshot|snapshots|restore|reproduce|simulate-install|destroy>');
  }finally{store.close();}
}


async function persistInteractionResult(cwd:string,result:{run:any;nodes:any[];edges:any[];findings:any[]}):Promise<void>{
  const store=await LocalStateStore.open(cwd);
  const evidence:EvidenceRecord[]=[];
  try{
    store.putInteractionRun(result.run);for(const n of result.nodes)store.putInteractionNode(n);for(const e of result.edges)store.putInteractionEdge(e);for(const f of result.findings)store.putInteractionFinding(f);
    for(const node of result.nodes.filter((n:any)=>n.kind==='page')){
      let subject:string|undefined;try{subject=`route:${new URL(node.url).pathname||'/'}`;}catch{}
      if(!subject)continue;const failed=result.findings.some((f:any)=>f.url===node.url&&f.severity==='error');const record:EvidenceRecord={id:`ev_${randomUUID().slice(0,12)}`,subject,claim:`Interaction ${result.run.kind} observed ${node.url}`,source:`senten.interaction:${result.run.engine}`,status:failed?'failed':'observed',strength:failed?0:2,evidenceType:'interaction',timestamp:result.run.endedAt,metadata:{runId:result.run.id,status:node.status,findings:result.findings.filter((f:any)=>f.url===node.url).length}};store.putEvidence(record);evidence.push(record);
    }
  }finally{store.close();}
  const ir=await loadIR(cwd);await writeIR(cwd,evidenceToSemantic(interactionToSemantic(result,ir),evidence));
}
async function crawlCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const url=args.find(a=>!a.startsWith('--'));if(!url)throw new Error('Usage: senten crawl <url> [--max-pages 50] [--external] [--json]');
  const maxPages=Number(flagValue(args,'--max-pages')??50);const timeoutMs=parseDurationMs(flagValue(args,'--timeout'));const result=await crawlWebsite(url,{maxPages,sameOrigin:!args.includes('--external'),...(timeoutMs!==undefined?{timeoutMs}:{})});await persistInteractionResult(cwd,result);
  if(args.includes('--json')){console.log(JSON.stringify(result,null,2));return;}
  console.log(`SENTEN CRAWL ${result.run.id}\nTarget        ${result.run.target}\nPages         ${result.run.pages}\nInteractions  ${result.run.interactions}\nFindings      ${result.run.findings}\nStatus        ${result.run.status}`);
  for(const f of result.findings.slice(0,20))console.log(`  ${f.severity.toUpperCase()} ${f.kind} ${f.url} — ${f.message}`);if(result.run.status==='failed'&&args.includes('--strict'))process.exitCode=1;
}
async function clickthruCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const url=args.find(a=>!a.startsWith('--'));if(!url)throw new Error('Usage: senten clickthru <url> [--browser chromium] [--device mobile|tablet|desktop] [--viewport 390x844] [--max-pages 20] [--headed] [--strict]');
  const browser=(flagValue(args,'--browser')??'chromium') as 'chromium'|'firefox'|'webkit';const timeoutMs=parseDurationMs(flagValue(args,'--timeout'));const viewport=parseViewport(flagValue(args,'--viewport')??deviceViewport(flagValue(args,'--device')));const includeActions=args.includes('--include-actions');if(includeActions&&!args.includes('--allow-live-effects'))throw new Error('Mutating click-through probes are not a containment boundary. Re-run with --allow-live-effects only for an explicitly authorized non-production target, or execute the target inside a network-denied Senten sandbox.');const result=await clickthruWebsite(url,{browser,headless:!args.includes('--headed'),maxPages:Number(flagValue(args,'--max-pages')??20),maxInteractionsPerPage:Number(flagValue(args,'--max-interactions')??100),includeActions,sameOrigin:!args.includes('--external'),...(timeoutMs!==undefined?{timeoutMs}:{}),...(viewport?{viewport}:{})});await persistInteractionResult(cwd,result);
  if(args.includes('--json')){console.log(JSON.stringify(result,null,2));return;}
  console.log(`SENTEN CLICKTHRU ${result.run.id}\nBrowser       ${browser}\nPages         ${result.run.pages}\nControls      ${result.run.interactions}\nFindings      ${result.run.findings}\nStatus        ${result.run.status}`);for(const f of result.findings.slice(0,30))console.log(`  ${f.severity.toUpperCase()} ${f.kind} ${f.url} — ${f.message}`);if(result.run.status==='failed'&&args.includes('--strict'))process.exitCode=1;
}
async function journeyCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const action=args[0]??'list';const dir=join(cwd,'.senten','journeys');await mkdir(dir,{recursive:true});
  if(action==='create'){const name=args[1],baseUrl=args[2];if(!name)throw new Error('Usage: senten journey create <name> [base-url]');const def:JourneyDefinition={senten:1,kind:'journey',name,version:'0.1.0',description:`Critical journey: ${name}`,...(baseUrl?{baseUrl}:{}),steps:[{id:'open',type:'goto',value:baseUrl??'${baseUrl}'},{id:'ready',type:'expect-visible',selector:'body'}]};const path=join(dir,`${slug(name)}.json`);if(await exists(path)&&!args.includes('--force'))throw new Error(`Journey already exists: ${name}`);await writeFile(path,JSON.stringify(def,null,2)+'\n');console.log(`JOURNEY CREATED ${name}\n${relative(cwd,path)}`);return;}
  if(action==='list'){const files=(await readdir(dir)).filter(f=>f.endsWith('.json'));if(!files.length){console.log('No journeys.');return;}for(const file of files){const def=JSON.parse(await readFile(join(dir,file),'utf8')) as JourneyDefinition;console.log(`${def.name.padEnd(24)} ${def.version.padEnd(10)} ${def.steps.length} steps  ${def.baseUrl??''}`);}return;}
  if(action==='inspect'){const name=args[1];if(!name)throw new Error('Usage: senten journey inspect <name>');const def=await loadJourneyFile(dir,name);console.log(JSON.stringify(def,null,2));return;}
  if(action==='run'){const name=args[1];if(!name)throw new Error('Usage: senten journey run <name> [--browser chromium] [--base-url URL] [--input key=value]');const def=await loadJourneyFile(dir,name);const inputs:Record<string,string>={};for(const item of multiFlagValues(args,'--input')){const [k,...v]=item.split('=');if(k)inputs[k]=v.join('=');}const browser=(flagValue(args,'--browser')??'chromium') as 'chromium'|'firefox'|'webkit';const baseUrl=flagValue(args,'--base-url');const viewport=parseViewport(flagValue(args,'--viewport')??deviceViewport(flagValue(args,'--device')));const result=await runJourney(def,{browser,headless:!args.includes('--headed'),...(baseUrl?{baseUrl}:{}),inputs,...(viewport?{viewport}:{})});const store=await LocalStateStore.open(cwd);const journeyEvidence:EvidenceRecord={id:`ev_${randomUUID().slice(0,12)}`,subject:`journey:${def.name}`,claim:`Critical journey ${def.name} ${result.run.status}`,source:`senten.interaction:${result.run.engine}`,status:result.run.status==='passed'?'tested':'failed',strength:result.run.status==='passed'?3:0,evidenceType:'interaction',timestamp:result.run.endedAt,metadata:{runId:result.run.id,steps:result.steps.length,findings:result.findings.length}};try{store.putInteractionRun(result.run);for(const f of result.findings)store.putInteractionFinding(f);store.putEvidence(journeyEvidence);}finally{store.close();}const journeyIr=await loadIR(cwd);await writeIR(cwd,evidenceToSemantic(journeyIr,[journeyEvidence]));console.log(`JOURNEY ${name} — ${result.run.status.toUpperCase()}\nRun      ${result.run.id}\nBrowser  ${browser}\nSteps    ${result.steps.length}\nFindings ${result.findings.length}`);for(const step of result.steps)console.log(`  ${step.status==='passed'?'✓':'✕'} ${step.id} (${step.type})${step.error?` — ${step.error}`:''}`);if(result.run.status==='failed')process.exitCode=1;return;}
  if(action==='history'){const store=await LocalStateStore.open(cwd);try{for(const run of store.listInteractionRuns('journey'))console.log(`${run.id.padEnd(14)} ${run.status.padEnd(7)} ${run.target.padEnd(24)} ${run.engine}`);}finally{store.close();}return;}
  throw new Error('Usage: senten journey <create|list|inspect|run|history>');
}
async function pathsCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const store=await LocalStateStore.open(cwd);try{const requested=args.find(a=>!a.startsWith('--'));const runs=store.listInteractionRuns();const run=requested?store.getInteractionRun(requested):runs.filter(r=>r.kind==='crawl'||r.kind==='clickthru').at(-1);if(!run)throw new Error('No crawl/clickthru interaction run found. Run: senten crawl <url>');const nodes=store.listInteractionNodes(run.id),edges=store.listInteractionEdges(run.id),findings=store.listInteractionFindings(run.id);if(args.includes('--json')){console.log(JSON.stringify({run,nodes,edges,findings},null,2));return;}console.log(`SENTEN PATHS — ${run.id}\nTarget    ${run.target}\nNodes     ${nodes.length}\nEdges     ${edges.length}\nFindings  ${findings.length}`);for(const edge of edges.filter(e=>e.kind==='link').slice(0,100))console.log(`  ${edge.from.replace('page:','')} -> ${edge.to.replace('page:','')}${edge.label?`  [${edge.label}]`:''}`);}finally{store.close();}
}
async function loadJourneyFile(dir:string,name:string):Promise<JourneyDefinition>{const candidates=[join(dir,`${slug(name)}.json`),join(dir,name)];for(const path of candidates)if(await exists(path))return JSON.parse(await readFile(path,'utf8')) as JourneyDefinition;throw new Error(`Journey not found: ${name}`);}

async function runtimeCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const action=args[0]??'status';const config=await loadConfig(cwd);const defaultEnvironment=config.environment??'development';const store=await LocalStateStore.open(cwd);
  try{
    if(action==='observe'){
      const subject=args[1];if(!subject)throw new Error('Usage: senten runtime observe <semantic-id> [--kind action] [--status observed] [--trace id]');
      const kind=(flagValue(args,'--kind')??inferRuntimeKind(subject)) as RuntimeObservationRecord['kind'];
      const status=(flagValue(args,'--status')??'observed') as RuntimeObservationRecord['status'];
      validateRuntimeKind(kind);validateRuntimeStatus(status);
      const traceId=flagValue(args,'--trace');const source=flagValue(args,'--source')??'senten.cli';const environment=flagValue(args,'--env')??defaultEnvironment;
      const observation=normalizeRuntimeObservation({kind,subject,status,...(traceId?{traceId}:{}),actor:actorFlag(args)}, {environment,source});
      store.putRuntimeObservation(observation);const evidence=observationToEvidence(observation);store.putEvidence(evidence);
      if(traceId){const trace=buildTrace(traceId,store.listRuntimeObservations({traceId}));store.putRuntimeTrace(trace);}
      const ir=await loadIR(cwd);await writeIR(cwd,evidenceToSemantic(ir,[evidence]));
      console.log(`RUNTIME OBSERVATION ${observation.id}\nSubject  ${subject}\nKind     ${kind}\nStatus   ${status}\nEvidence ${evidence.id}${traceId?`\nTrace    ${traceId}`:''}`);return;
    }
    if(action==='ingest'){
      const file=args[1];if(!file)throw new Error('Usage: senten runtime ingest <json-or-jsonl-file> [--source name] [--env environment]');
      const raw=await readFile(resolve(cwd,file),'utf8');const rows=parseRuntimeInput(raw);const source=flagValue(args,'--source')??`file:${relative(cwd,resolve(cwd,file))}`;const environment=flagValue(args,'--env')??defaultEnvironment;const observations:RuntimeObservationRecord[]=[];const evidence:EvidenceRecord[]=[];
      for(const row of rows){validateRuntimeKind(row.kind);validateRuntimeStatus(row.status);const observation=normalizeRuntimeObservation(row,{environment,source});store.putRuntimeObservation(observation);observations.push(observation);const ev=observationToEvidence(observation);store.putEvidence(ev);evidence.push(ev);}
      for(const traceId of new Set(observations.map(o=>o.traceId).filter((v):v is string=>Boolean(v))))store.putRuntimeTrace(buildTrace(traceId,store.listRuntimeObservations({traceId})));
      const ir=await loadIR(cwd);await writeIR(cwd,evidenceToSemantic(ir,evidence));
      console.log(`RUNTIME INGEST\nFile          ${relative(cwd,resolve(cwd,file))}\nObservations  ${observations.length}\nEvidence      ${evidence.length}\nTraces        ${new Set(observations.map(o=>o.traceId).filter(Boolean)).size}`);return;
    }
    if(action==='observations'){
      const subject=args[1]&&!args[1].startsWith('-')?args[1]:flagValue(args,'--subject');const traceId=flagValue(args,'--trace');const kind=flagValue(args,'--kind');const status=flagValue(args,'--status');const rows=store.listRuntimeObservations({...((subject)?{subject}:{}),...(traceId?{traceId}:{}),...(kind?{kind}:{}),...(status?{status}:{})});
      if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));if(!rows.length)return console.log('No runtime observations.');for(const row of rows.slice().reverse())console.log(`${row.id.padEnd(18)} ${row.status.padEnd(8)} ${row.kind.padEnd(16)} ${row.subject}${row.traceId?`  ${row.traceId}`:''}`);return;
    }
    if(action==='traces'){
      const rows=store.listRuntimeTraces();if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));if(!rows.length)return console.log('No runtime traces.');for(const row of rows.slice().reverse())console.log(`${row.id.padEnd(20)} ${row.status.padEnd(8)} ${String(row.observationIds.length).padEnd(4)} ${row.name}`);return;
    }
    if(action==='trace'){
      const id=args[1];if(!id)throw new Error('Usage: senten runtime trace <trace-id>');const trace=store.getRuntimeTrace(id)??(store.listRuntimeObservations({traceId:id}).length?buildTrace(id,store.listRuntimeObservations({traceId:id})):undefined);if(!trace)throw new Error(`Trace not found: ${id}`);const observations=store.listRuntimeObservations({traceId:id});if(args.includes('--json'))return console.log(JSON.stringify({trace,observations},null,2));console.log(`RUNTIME TRACE ${trace.id}\nName         ${trace.name}\nStatus       ${trace.status}\nEnvironment  ${trace.environment}\nObservations ${observations.length}`);for(const row of observations)console.log(`  ${row.timestamp} ${row.status.padEnd(8)} ${row.kind.padEnd(16)} ${row.subject}`);return;
    }
    if(action==='alignment'||action==='drift'){
      const ir=await loadIR(cwd);const report=runtimeAlignment(ir,store.listRuntimeObservations());if(args.includes('--json'))return console.log(JSON.stringify(report,null,2));console.log(`RUNTIME ALIGNMENT\nDeclared subjects ${report.declaredSubjects}\nObserved subjects ${report.observedSubjects}\nMatched           ${report.matched}\nCoverage          ${(report.coverage*100).toFixed(1)}%\nRuntime-only      ${report.runtimeOnly.length}\nUnobserved        ${report.unobserved.length}\nFailures          ${report.failures.length}`);for(const id of report.runtimeOnly.slice(0,20))console.log(`  ! runtime-only ${id}`);for(const failure of report.failures.slice(0,20))console.log(`  ✕ ${failure.kind} ${failure.subject} (${failure.status})`);if(args.includes('--strict')&&(report.runtimeOnly.length||report.failures.length))process.exitCode=1;return;
    }
    if(action==='status'){
      const observations=store.listRuntimeObservations();const traces=store.listRuntimeTraces();const evidence=store.listEvidence();const ir=await loadIR(cwd);const report=runtimeAlignment(ir,observations);console.log(`SENTEN RUNTIME\nObservations  ${observations.length}\nTraces        ${traces.length}\nEvidence      ${evidence.length}\nCoverage      ${(report.coverage*100).toFixed(1)}%\nRuntime-only  ${report.runtimeOnly.length}\nFailures      ${report.failures.length}`);return;
    }
    throw new Error('Usage: senten runtime <status|observe|ingest|observations|traces|trace|alignment>');
  }finally{store.close();}
}

async function evidenceCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const action=args[0]??'summary';const store=await LocalStateStore.open(cwd);
  try{
    if(action==='test'){
      const subject=args[1];const sep=args.indexOf('--');if(!subject||sep<0||!args[sep+1])throw new Error('Usage: senten evidence test <subject> --allow-exec -- <command> [args...]');if(!args.includes('--allow-exec'))throw new Error('Dynamic test evidence requires explicit --allow-exec authorization.');
      const command=args[sep+1]!;const commandArgs=args.slice(sep+2);const run=spawnSync(command,commandArgs,{cwd,encoding:'utf8',shell:false,timeout:Number(flagValue(args,'--timeout')??120000)});const status:EvidenceRecord['status']=run.status===0?'tested':'failed';const record:EvidenceRecord=normalizeEvidence({id:`ev_${randomUUID().slice(0,12)}`,subject,claim:`Explicit test command ${status==='tested'?'passed':'failed'}: ${[command,...commandArgs].join(' ')}`,source:`command:${basename(command)}`,status,timestamp:new Date().toISOString(),evidenceType:'test',metadata:{command:[command,...commandArgs],exitCode:run.status,signal:run.signal??null,stdoutDigest:sha256(run.stdout??''),stderrDigest:sha256(run.stderr??'')}});store.putEvidence(record);const ir=await loadIR(cwd);await writeIR(cwd,evidenceToSemantic(ir,[record]));if(args.includes('--json'))console.log(JSON.stringify(record,null,2));else console.log(`TEST EVIDENCE ${record.id}
Subject  ${subject}
Status   ${status}
Exit     ${run.status??'-'}
Source   ${record.source}`);if(status==='failed')process.exitCode=1;return;
    }
    if(action==='add'||action==='record'){
      const subject=args[1];const claim=flagValue(args,'--claim')??collectPositionalAfter(args,2);if(!subject||!claim)throw new Error('Usage: senten evidence add <subject> <claim> [--status observed] [--source manual]');const status=(flagValue(args,'--status')??'observed') as EvidenceRecord['status'];validateEvidenceStatus(status);if(status==='verified')throw new Error('Manual evidence cannot be marked verified. Import trusted independent verifier results (for example LaunchProof) instead.');const environment=flagValue(args,'--env');const record:EvidenceRecord=normalizeEvidence({id:`ev_${randomUUID().slice(0,12)}`,subject,claim,source:flagValue(args,'--source')??'manual',status,timestamp:new Date().toISOString(),evidenceType:'manual',...(environment?{environment}:{})});store.putEvidence(record);const ir=await loadIR(cwd);await writeIR(cwd,evidenceToSemantic(ir,[record]));console.log(`EVIDENCE ${record.id}\nSubject  ${subject}\nStatus   ${status}\nStrength ${record.strength}\nSource   ${record.source}`);return;
    }
    if(action==='list'){
      const subject=flagValue(args,'--subject')??(args[1]&&!args[1].startsWith('-')?args[1]:undefined);const status=flagValue(args,'--status');const source=flagValue(args,'--source');const rows=store.listEvidence({...((subject)?{subject}:{}),...(status?{status}:{}),...(source?{source}:{})});if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));if(!rows.length)return console.log('No evidence records.');for(const r of rows.slice().reverse())console.log(`${r.id.padEnd(20)} ${r.status.padEnd(9)} S${String(r.strength??evidenceStrength(r.status))} ${String(r.subject??'-').padEnd(34)} ${r.source}`);return;
    }
    if(action==='inspect'){
      const id=args[1];if(!id)throw new Error('Usage: senten evidence inspect <id>');const record=store.getEvidence(id);if(!record)throw new Error(`Evidence not found: ${id}`);console.log(JSON.stringify(record,null,2));return;
    }
    if(action==='summary'){
      const subject=args[1]&&!args[1].startsWith('-')?args[1]:flagValue(args,'--subject');const summary=summarizeEvidence(store.listEvidence(),subject);if(args.includes('--json'))return console.log(JSON.stringify(summary,null,2));console.log(`EVIDENCE SUMMARY${subject?` — ${subject}`:''}\nTotal     ${summary.total}\nDeclared  ${summary.declared}\nObserved  ${summary.observed}\nTested    ${summary.tested}\nVerified  ${summary.verified}\nFailed    ${summary.failed}\nUnknown   ${summary.unknown}\nStrongest ${summary.strongest}\nStrength  ${summary.strength}/4${summary.latestAt?`\nLatest    ${summary.latestAt}`:''}`);return;
    }
    if(action==='export'){
      const rows=store.listEvidence();const out=flagValue(args,'--output');const payload=JSON.stringify(rows,null,2)+'\n';if(out){await writeFile(resolve(cwd,out),payload);console.log(`EVIDENCE EXPORTED ${rows.length} -> ${out}`);}else console.log(payload.trimEnd());return;
    }
    throw new Error('Usage: senten evidence <add|test|list|inspect|summary|export>');
  }finally{store.close();}
}

async function guaranteeCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const target=args.find(a=>!a.startsWith('-'));if(!target)throw new Error('Usage: senten guarantee <semantic-id> [--json] [--strict]');const ir=await loadIR(cwd);const resolved=resolveSemanticRef(target,ir.nodes);const store=await LocalStateStore.open(cwd);try{const result=evaluateGuarantee(resolved,store.listEvidence(),ir);if(args.includes('--json')){console.log(JSON.stringify(result,null,2));}else{console.log(`SENTEN GUARANTEE — ${resolved}\nStatus    ${result.status.toUpperCase()}\nStrength  ${result.strength}/4\nEvidence  ${result.evidence.length}\nReason    ${result.reason}`);for(const ev of result.evidence.slice(-10))console.log(`  ${ev.status.padEnd(9)} ${ev.source} — ${ev.claim}`);}if(args.includes('--strict')&&!['verified','supported'].includes(result.status))process.exitCode=1;}finally{store.close();}
}


async function assuranceCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const action=args[0]??'claims';const ir=await loadIR(cwd);const claims=extractAssuranceClaims(ir);const store=await LocalStateStore.open(cwd);
  try{
    if(action==='claims'){
      if(args.includes('--json'))return console.log(JSON.stringify(claims,null,2));
      if(!claims.length)return console.log('No assurance claims discovered.');
      for(const c of claims)console.log(`${c.id}  ${c.kind.padEnd(10)} ${c.subject}\n  ${c.statement}`);return;
    }
    if(action==='case'){
      const sub=args[1]??'list';
      if(sub==='create'){
        const name=args[2];if(!name)throw new Error('Usage: senten assurance case create <name> [--claim <semantic-id>]');
        const subjects=multiFlagValues(args,'--claim').map(x=>resolveSemanticRef(x,ir.nodes));
        const selected=subjects.length?claims.filter(c=>subjects.includes(c.subject)):claims.filter(c=>c.kind==='invariant'||c.kind==='policy');
        if(!selected.length)throw new Error('No matching assurance claims. Run: senten assurance claims');
        const rec=createAssuranceCase(name,selected.map(c=>c.id),`${actorFlag(args).type}:${actorFlag(args).id}`);store.putAssuranceCase(rec);
        console.log(`ASSURANCE CASE CREATED ${rec.id}\nName    ${rec.name}\nClaims  ${rec.claimIds.length}\nStatus  ${rec.status}`);return;
      }
      if(sub==='list'){
        const rows=store.listAssuranceCases();if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));if(!rows.length)return console.log('No Assurance Cases.');for(const r of rows)console.log(`${r.id}  ${r.status.padEnd(10)} ${r.name} (${r.claimIds.length} claims)`);return;
      }
      if(sub==='inspect'||sub==='evaluate'){
        const id=args[2];if(!id)throw new Error(`Usage: senten assurance case ${sub} <id|name>`);const rec=store.getAssuranceCase(id)??store.listAssuranceCases().find(x=>x.name===id);if(!rec)throw new Error(`Assurance Case not found: ${id}`);
        const evaluated=evaluateAssuranceCase(rec,claims,store.listEvidence(),ir);
        const resultIds=[...new Set(evaluated.evidenceIds.map(eid=>store.getEvidence(eid)?.provenance?.resultBundleId).filter((x):x is string=>typeof x==='string'))];
        const next={...evaluated,verificationResultIds:resultIds};if(sub==='evaluate')store.putAssuranceCase(next);
        if(args.includes('--json'))return console.log(JSON.stringify(next,null,2));console.log(`ASSURANCE CASE — ${next.name}\nID        ${next.id}\nStatus    ${next.status.toUpperCase()}\nClaims    ${next.claimIds.length}\nEvidence  ${next.evidenceIds.length}\nLaunchProof results ${next.verificationResultIds.length}`);return;
      }
      throw new Error('Usage: senten assurance case <create|list|inspect|evaluate>');
    }
    throw new Error('Usage: senten assurance <claims|case>');
  }finally{store.close();}
}

async function launchProofCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const action=args[0]??'status';const store=await LocalStateStore.open(cwd);
  try{
    if(action==='export'){
      const ir=await loadIR(cwd);const subjects=multiFlagValues(args,'--subject').map(x=>resolveSemanticRef(x,ir.nodes));const config=await loadConfig(cwd);
      const bundle=createAssuranceExchange({sentenVersion:VERSION,ir,evidence:store.listEvidence(),...(subjects.length?{subjects}:{}),environment:config.environment??'development'});
      const dir=join(cwd,'.senten','artifacts','assurance');await mkdir(dir,{recursive:true});const output=resolve(cwd,flagValue(args,'--output')??join('.senten','artifacts','assurance',`${bundle.id}.senten-assurance.json`));await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(bundle,null,2)+'\n');
      store.putAssuranceExchange({id:`xchg_${randomUUID().slice(0,12)}`,createdAt:bundle.generatedAt,direction:'export',peer:'launchproof',bundleId:bundle.id,bundleDigest:bundle.digest,artifactPath:relative(cwd,output),status:'created',metadata:{claims:bundle.claims.length,evidence:bundle.evidence.length}});
      if(args.includes('--json'))return console.log(JSON.stringify(bundle,null,2));console.log(`LAUNCHPROOF EXPORT ${bundle.id}\nClaims      ${bundle.claims.length}\nEvidence    ${bundle.evidence.length}\nStateTruss  ${bundle.stateTrussDigest.slice(0,16)}...\nDigest      ${bundle.digest}\nPath        ${relative(cwd,output)}`);return;
    }
    if(action==='import'){
      const file=args[1];if(!file)throw new Error('Usage: senten launchproof import <result.json> [--source <assurance-bundle.json>]');
      const result=JSON.parse(await readFile(resolve(cwd,file),'utf8')) as LaunchProofResultBundle;
      const sourcePath=flagValue(args,'--source');let source:AssuranceExchangeBundle|undefined;
      if(sourcePath)source=JSON.parse(await readFile(resolve(cwd,sourcePath),'utf8')) as AssuranceExchangeBundle;
      else{const exchange=store.listAssuranceExchanges().slice().reverse().find(x=>x.direction==='export'&&x.bundleId===result.sourceBundleId&&x.artifactPath);if(exchange?.artifactPath)source=JSON.parse(await readFile(resolve(cwd,exchange.artifactPath),'utf8')) as AssuranceExchangeBundle;}
      if(!source)throw new Error(`Source assurance bundle ${result.sourceBundleId} not found. Use --source <bundle.json>.`);
      const trust=await loadTrustStore(cwd);const imported=launchProofResultToEvidence(result,source,trust);if(!imported.accepted)throw new Error(`LaunchProof result rejected:\n- ${imported.errors.join('\n- ')}`);
      store.putLaunchProofResult(result);for(const ev of imported.evidence)store.putEvidence(ev);
      const ir=await loadIR(cwd);await writeIR(cwd,evidenceToSemantic(ir,imported.evidence));
      store.putAssuranceExchange({id:`xchg_${randomUUID().slice(0,12)}`,createdAt:new Date().toISOString(),direction:'import',peer:'launchproof',bundleId:result.id,bundleDigest:sha256(JSON.stringify(result)),artifactPath:relative(cwd,resolve(cwd,file)),status:'verified',metadata:{sourceBundleId:result.sourceBundleId,trusted:imported.trusted,evidence:imported.evidence.length,warnings:imported.warnings}});
      console.log(`LAUNCHPROOF IMPORT ${result.id}\nResults     ${result.results.length}\nEvidence    ${imported.evidence.length}\nTrusted     ${imported.trusted?'yes':'no'}\nStrength    ${imported.trusted?'verified (4/4)':'tested (3/4)'}`);for(const w of imported.warnings)console.log(`  ! ${w}`);return;
    }
    if(action==='status'){
      const exchanges=store.listAssuranceExchanges();const results=store.listLaunchProofResults();const lpEvidence=store.listEvidence({source:'launchproof'});if(args.includes('--json'))return console.log(JSON.stringify({exchanges,results,evidence:lpEvidence},null,2));console.log(`LAUNCHPROOF STATUS\nExchanges  ${exchanges.length}\nResults    ${results.length}\nImported evidence ${store.listEvidence().filter(e=>e.source.startsWith('launchproof:')).length}`);for(const x of exchanges.slice(-10).reverse())console.log(`  ${x.direction.padEnd(6)} ${x.status.padEnd(8)} ${x.bundleId} ${x.artifactPath??''}`);return;
    }
    throw new Error('Usage: senten launchproof <export|import|status>');
  }finally{store.close();}
}

function parseRuntimeInput(raw:string):Array<Partial<RuntimeObservationRecord>&Pick<RuntimeObservationRecord,'kind'|'subject'|'status'>>{
  const trimmed=raw.trim();if(!trimmed)return [];
  try{const parsed=JSON.parse(trimmed) as unknown;const rows=Array.isArray(parsed)?parsed:(parsed&&typeof parsed==='object'&&Array.isArray((parsed as {observations?:unknown[]}).observations)?(parsed as {observations:unknown[]}).observations:[parsed]);return rows.map(coerceRuntimeObservation);}
  catch{return trimmed.split(/\r?\n/).filter(Boolean).map(line=>coerceRuntimeObservation(JSON.parse(line) as unknown));}
}
function coerceRuntimeObservation(value:unknown):Partial<RuntimeObservationRecord>&Pick<RuntimeObservationRecord,'kind'|'subject'|'status'>{if(!value||typeof value!=='object')throw new Error('Runtime observation must be an object.');const r=value as Record<string,unknown>;if(typeof r.kind!=='string'||typeof r.subject!=='string'||typeof r.status!=='string')throw new Error('Runtime observation requires kind, subject, and status.');return r as Partial<RuntimeObservationRecord>&Pick<RuntimeObservationRecord,'kind'|'subject'|'status'>;}
function inferRuntimeKind(subject:string):RuntimeObservationRecord['kind']{const prefix=subject.split(':',1)[0];if(['action','invariant','policy','effect','state'].includes(prefix??''))return prefix==='state'?'state-transition':prefix as RuntimeObservationRecord['kind'];return 'custom';}
function validateRuntimeKind(kind:string):asserts kind is RuntimeObservationRecord['kind']{if(!['trace','action','state-transition','invariant','policy','effect','error','custom'].includes(kind))throw new Error(`Invalid runtime kind: ${kind}`);}
function validateRuntimeStatus(status:string):asserts status is RuntimeObservationRecord['status']{if(!['started','observed','passed','failed','denied','unknown'].includes(status))throw new Error(`Invalid runtime status: ${status}`);}
function validateEvidenceStatus(status:string):asserts status is EvidenceRecord['status']{if(!['declared','observed','tested','verified','unknown','failed'].includes(status))throw new Error(`Invalid evidence status: ${status}`);}
function collectPositionalAfter(args:string[],start:number):string{const out:string[]=[];for(let i=start;i<args.length;i++){const v=args[i]!;if(v.startsWith('--')){if(i+1<args.length&&!args[i+1]!.startsWith('--'))i++;continue;}out.push(v);}return out.join(' ');}



async function reportCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const action=args[0]??'project';
  if(action==='list'){
    const store=await LocalStateStore.open(cwd);try{const rows=store.listReports().slice().reverse();if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));if(!rows.length)return console.log('No reports generated.');for(const r of rows)console.log(`${r.id}  ${r.kind.padEnd(13)} ${r.format.padEnd(5)} ${r.path}`);return;}finally{store.close();}
  }
  const validKinds=['project','architecture','evidence','assurance','runtime','interactions','agents','operations'];
  if(!validKinds.includes(action))throw new Error(`Unknown report kind: ${action}`);
  const format=(flagValue(args,'--format')??'html') as ReportFormat;
  if(!['json','md','html'].includes(format))throw new Error(`Unsupported report format: ${format}`);
  const output=flagValue(args,'--output'); const rec=await writeReport(cwd,{kind:action as ReportKind,format,...(output?{output}:{})});
  if(args.includes('--json'))return console.log(JSON.stringify(rec,null,2));
  console.log(`REPORT CREATED ${rec.id}\nKind      ${rec.kind}\nFormat    ${rec.format}\nPath      ${rec.path}\nSHA-256   ${rec.digest}`);
}

async function observatoryCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const host=flagValue(args,'--host')??'127.0.0.1'; const rawPort=flagValue(args,'--port'); const port=rawPort?Number(rawPort):43177;
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error(`Invalid --port: ${rawPort}`);
  const server=await startObservatory(cwd,{host,port,open:args.includes('--open'),allowRemote:args.includes('--allow-remote')});
  console.log(`SENTEN OBSERVATORY\nURL       ${server.url}\nMode      local read-only\nProject   ${cwd}\n\nPress Ctrl+C to stop.`);
  await new Promise<void>((resolve)=>{const stop=()=>{process.off('SIGINT',stop);process.off('SIGTERM',stop);server.close().finally(resolve)};process.on('SIGINT',stop);process.on('SIGTERM',stop);});
}

async function doctor(cwd:string,args:string[]):Promise<void>{
  const initialized=await exists(join(cwd,'senten.config.json'));
  if(!initialized){
    const checks=[{name:'Node >=22.5',ok:nodeAtLeast(22,5),detail:process.versions.node,required:true},{name:'Senten project',ok:false,detail:'not initialized',required:true}];
    if(args.includes('--json'))console.log(JSON.stringify({version:VERSION,initialized:false,checks,next:'senten init'},null,2));else console.log(`SENTEN DOCTOR\n✓ Node >=22.5 (${process.versions.node})\n○ Senten has not been initialized in this directory.\n\nRun:\n  senten init\n\nThen:\n  senten discover\n  senten doctor`);
    process.exitCode=1;return;
  }
  const checks:Array<{name:string;ok:boolean;detail:string;required:boolean}>=[];
  checks.push({name:'CLI distribution',ok:true,detail:`${VERSION} via ${process.argv[1]??'unknown entrypoint'}`,required:true});
  try{const pkg=JSON.parse(await readFile(join(cwd,'package.json'),'utf8')) as {name?:string;version?:string;dependencies?:Record<string,string>;devDependencies?:Record<string,string>};
    if(pkg.name==='senten'&&pkg.version&&pkg.version!==VERSION)checks.push({name:'CLI/source version alignment',ok:false,detail:`running ${VERSION}; repository package.json is ${pkg.version}`,required:true});
    const requested=pkg.dependencies?.senten??pkg.devDependencies?.senten;if(requested&&/^\d+\.\d+\.\d+/.test(requested)&&requested!==VERSION)checks.push({name:'Project Senten dependency alignment',ok:false,detail:`running ${VERSION}; project requests senten ${requested}`,required:false});
  }catch{}
  checks.push({name:'Node >=22.5',ok:nodeAtLeast(22,5),detail:process.versions.node,required:true});
  checks.push({name:'senten.config.json',ok:await exists(join(cwd,'senten.config.json')),detail:'',required:true});
  checks.push({name:'.senten directory',ok:await exists(join(cwd,'.senten')),detail:'',required:true});
  checks.push({name:'StateTruss IR',ok:await exists(join(cwd,'.senten','state-truss.json')),detail:'',required:true});
  const dbExists=await exists(join(cwd,'.senten','senten.db'));checks.push({name:'Local state DB',ok:dbExists,detail:'',required:true});
  if(dbExists){try{const store=await LocalStateStore.open(cwd);const integrity=store.integrityCheck();checks.push({name:'SQLite integrity',ok:integrity==='ok',detail:integrity,required:true});checks.push({name:'State schema',ok:store.schemaVersion()>=10,detail:String(store.schemaVersion()),required:true});store.close();}catch(error){checks.push({name:'SQLite integrity',ok:false,detail:error instanceof Error?error.message:String(error),required:true});}}
  checks.push({name:'Cache store',ok:await exists(join(cwd,'.senten','cache')),detail:'',required:true});
  const source=await exists(join(cwd,'.senten','cache','source','manifest.json'));checks.push({name:'Source intelligence',ok:source,detail:source?'discovered':'run senten discover',required:false});
  if(args.includes('--json'))console.log(JSON.stringify({version:VERSION,checks},null,2));else{console.log('SENTEN DOCTOR');for(const c of checks)console.log(`${c.ok?'✓':c.required?'✕':'○'} ${c.name}${c.detail?` (${c.detail})`:''}`);}
  if(checks.some(c=>c.required&&!c.ok)||(args.includes('--strict')&&checks.some(c=>!c.ok)))process.exitCode=1;
}
async function proof(cwd:string,args:string[]):Promise<void>{const ir=await loadIR(cwd);const target=args.find(a=>!a.startsWith('-'));const store=await LocalStateStore.open(cwd);try{const candidates=target?[resolveSemanticRef(target,ir.nodes)]:ir.nodes.filter(n=>n.kind==='invariant'||n.kind==='policy').map(n=>n.id);const evidence=store.listEvidence();const results=candidates.map(id=>evaluateGuarantee(id,evidence,ir));const counts=countBy(results,r=>r.status);if(args.includes('--json'))return console.log(JSON.stringify(results,null,2));console.log(`SENTEN PROOF${target?` — ${target}`:''}
Guarantees     ${results.length}
Verified       ${counts.verified??0}
Supported      ${counts.supported??0}
Observed       ${counts.observed??0}
Declared       ${counts.declared??0}
Failed         ${counts.failed??0}
Unknown        ${counts.unknown??0}
LaunchProof    ${store.listLaunchProofResults().length} result bundle(s), ${evidence.filter(e=>e.source.startsWith('launchproof:')&&e.status==='verified'&&e.provenance?.publisherTrusted===true).length} trusted verification(s)`);for(const r of results.slice(0,50))console.log(`  ${r.status.toUpperCase().padEnd(9)} S${r.strength} ${r.target}`);if(args.includes('--strict')&&results.some(r=>!['verified','supported'].includes(r.status)))process.exitCode=1;}finally{store.close();}}


async function releaseCommand(cwd:string,args:string[]):Promise<void>{
  const action=args[0]??'check'; if(action!=='check')throw new Error('Usage: senten release check [--strict] [--rc] [--json]');
  const report=await runReleaseReadiness(cwd);let rc:unknown=undefined;let rcFailed=false;
  if(args.includes('--rc')){await requireInitialized(cwd);const ir=await loadIR(cwd);const adoption=await analyzeAdoption(cwd,ir);let packageVersion='unknown';try{const pkg=JSON.parse(await readFile(join(cwd,'package.json'),'utf8')) as {version?:string};packageVersion=pkg.version??'unknown';}catch{}const compat=compatibilityReport(ir);const critical=adoption.gaps.filter(g=>g.severity==='critical');const requirements={releaseCandidateVersion:/-rc\./.test(packageVersion)||/-rc\./.test(VERSION),compatibility:compat.compatible,noCriticalAdoptionGaps:critical.length===0};rc={version:VERSION,packageVersion,compatibility:compat,adoption:{readiness:adoption.readiness,criticalGaps:critical},requirements};rcFailed=!(requirements.releaseCandidateVersion&&requirements.compatibility&&requirements.noCriticalAdoptionGaps);}
  if(args.includes('--json'))console.log(JSON.stringify({...report,...(rc?{rc}:{})},null,2));
  else{console.log(`SENTEN RELEASE CHECK
Ready      ${report.ready&&!rcFailed?'yes':'no'}
Passed     ${report.passed}
Warnings   ${report.warnings}
Errors     ${report.errors}
Duration   ${report.durationMs}ms`);for(const c of report.checks)console.log(`  ${c.status==='pass'?'✓':c.status==='warn'?'!':'✕'} ${c.label}: ${c.detail}`);if(rc){const r=rc as {packageVersion:string;requirements:{releaseCandidateVersion:boolean;compatibility:boolean;noCriticalAdoptionGaps:boolean}};console.log(`RC gate
  ${r.requirements.releaseCandidateVersion?'✓':'✕'} release-candidate version (${r.packageVersion})
  ${r.requirements.compatibility?'✓':'✕'} protocol compatibility
  ${r.requirements.noCriticalAdoptionGaps?'✓':'✕'} no critical adoption gaps`);}}
  if(!report.ready||rcFailed||(args.includes('--strict')&&report.warnings>0))process.exitCode=1;
}

async function benchmarkCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const iterations=Math.max(1,Math.min(1000,Number(flagValue(args,'--iterations')??'20')));if(!Number.isFinite(iterations))throw new Error('Invalid --iterations');
  const ir=await benchmark('state-truss-read',iterations,()=>loadIR(cwd));
  const db=await benchmark('state-db-open-query-close',iterations,async()=>{const store=await LocalStateStore.open(cwd);store.listOperations();store.listEvidence();store.close();});
  const out={version:1,generatedAt:new Date().toISOString(),iterations,benchmarks:[ir,db]};if(args.includes('--json'))console.log(JSON.stringify(out,null,2));else{console.log(`SENTEN BENCHMARK — ${iterations} iterations`);for(const b of out.benchmarks)console.log(`${b.name.padEnd(28)} avg ${b.averageMs.toFixed(3)}ms  min ${b.minMs.toFixed(3)}ms  max ${b.maxMs.toFixed(3)}ms`);}
}

function schemaCommand(registry:ExtensionRegistry,args:string[]):void{
  if(args[0]!=='command'||!args[1])throw new Error('Usage: senten schema command <name>'); const name=args[1];
  const core=(CORE_COMMANDS as readonly string[]).includes(name);const ext=registry.get(name);if(!core&&!ext)throw new Error(`Unknown command namespace: ${name}`);
  const schema={schemaVersion:1,name,source:core?'core':`extension:${name}`,capability:commandCapability(name),invocation:`senten ${name} [args]`,supports:{json:true,actor:true},stability:['release','benchmark','schema'].includes(name)?'experimental':'alpha'};
  console.log(JSON.stringify(schema,null,2));
}


async function agentCommand(cwd:string,args:string[],registry:ExtensionRegistry):Promise<void>{
  await requireInitialized(cwd); const action=args[0]??'list'; const store=await LocalStateStore.open(cwd);
  try{
    if(action==='create'){const name=args[1];if(!name)throw new Error('Usage: senten agent create <name> [--provider x] [--model x]');const idOpt=flagValue(args,'--id'),provider=flagValue(args,'--provider'),model=flagValue(args,'--model'),description=flagValue(args,'--description');const rec=createAgent({name,...(idOpt?{id:idOpt}:{}),...(provider?{provider}:{}),...(model?{model}:{}),...(description?{description}:{}),actor:actorFlag(args)});store.putAgent(rec);console.log(`AGENT CREATED ${rec.id}\nStatus ${rec.status}`);return;}
    if(action==='list'){const rows=store.listAgents();if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));if(!rows.length)return console.log('No agents configured.');for(const a of rows)console.log(`${a.id.padEnd(18)} ${a.status.padEnd(8)} ${(a.provider??'-').padEnd(12)} ${a.model??'-'}`);return;}
    if(action==='inspect'){const id=args[1];if(!id)throw new Error('Usage: senten agent inspect <id>');const a=store.getAgent(id);if(!a)throw new Error(`Agent not found: ${id}`);console.log(JSON.stringify(a,null,2));return;}
    if(action==='grant'){const id=args[1],cap=args[2];if(!id||!cap)throw new Error('Usage: senten agent grant <id> <capability> [--target x] [--deny]');const a=store.getAgent(id);if(!a)throw new Error(`Agent not found: ${id}`);const target=flagValue(args,'--target');const next=addGrant(a,{effect:args.includes('--deny')?'deny':'allow',capability:cap,...(target?{target}:{}),actor:actorFlag(args)});store.putAgent(next);const g=next.grants.at(-1)!;console.log(`GRANT ${g.id} ${g.effect.toUpperCase()} ${g.capability}${g.target?` -> ${g.target}`:''}`);return;}
    if(action==='revoke'){const id=args[1],grantId=args[2];if(!id||!grantId)throw new Error('Usage: senten agent revoke <id> <grant-id>');const a=store.getAgent(id);if(!a)throw new Error(`Agent not found: ${id}`);store.putAgent(removeGrant(a,grantId));console.log(`GRANT REVOKED ${grantId}`);return;}
    if(action==='disable'||action==='enable'){const id=args[1];if(!id)throw new Error(`Usage: senten agent ${action} <id>`);const a=store.getAgent(id);if(!a)throw new Error(`Agent not found: ${id}`);store.putAgent({...a,status:action==='enable'?'active':'disabled',updatedAt:new Date().toISOString()});console.log(`AGENT ${id} ${action==='enable'?'ENABLED':'DISABLED'}`);return;}
    if(action==='history'){const id=args[1]&&!args[1].startsWith('-')?args[1]:undefined;const rows=store.listAgentRuns(id).slice().reverse();if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));if(!rows.length)return console.log('No agent runs.');for(const r of rows)console.log(`${r.id}  ${r.status.padEnd(7)} ${r.agentId.padEnd(16)} ${r.command} ${r.args.join(' ')}`);return;}
    if(action==='change-bundle'){const runId=args[1];if(!runId)throw new Error('Usage: senten agent change-bundle <run-id>');const run=store.getAgentRun(runId);if(!run)throw new Error(`Agent run not found: ${runId}`);const ops=run.operationIds.map(id=>store.getOperation(id)).filter((x):x is OperationRecord=>Boolean(x));const bundle=buildChangeBundle({intent:run.task??`${run.command} ${run.args.join(' ')}`,run,operations:ops,actor:{type:'agent',id:run.agentId},...(run.contextBundleId?{contextBundleId:run.contextBundleId}:{})});store.putChangeBundle(bundle);console.log(JSON.stringify(bundle,null,2));return;}
    if(action==='handoff'){const from=args[1],to=args[2],task=flagValue(args,'--task');if(!from||!to||!task)throw new Error('Usage: senten agent handoff <from> <to> --task <task>');const source=store.getAgent(from),target=store.getAgent(to);if(!source)throw new Error(`Agent not found: ${from}`);if(!target)throw new Error(`Agent not found: ${to}`);if(target.status!=='active')throw new Error(`Target agent is not active: ${to}`);const context=await generateContext(cwd,task,target);await saveContextArtifact(cwd,context);const handoff={id:`handoff_${randomUUID().slice(0,10)}`,createdAt:new Date().toISOString(),fromAgentId:from,toAgentId:to,task,contextBundleId:context.id,permissions:context.permissions,sourceDigest:context.sourceDigest,policy:'project-scoped; credentials excluded; target-agent grants applied'};const dir=join(cwd,'.senten','artifacts','handoffs');await mkdir(dir,{recursive:true});await writeFile(join(dir,`${handoff.id}.json`),JSON.stringify(handoff,null,2)+'\n');if(args.includes('--json'))return console.log(JSON.stringify(handoff,null,2));console.log(`AGENT HANDOFF ${handoff.id}\nFrom       ${from}\nTo         ${to}\nTask       ${task}\nContext    ${context.id}\nPolicy     ${handoff.policy}`);return;}
  }finally{ if(action!=='run')store.close(); }
  if(action==='run')return runAgent(cwd,args.slice(1),registry,store);
  throw new Error('Usage: senten agent <create|list|inspect|grant|revoke|enable|disable|run|history|change-bundle|handoff>');
}

async function runAgent(cwd:string,args:string[],registry:ExtensionRegistry,store:LocalStateStore):Promise<void>{
  try{const id=args[0];if(!id)throw new Error('Usage: senten agent run <id> [--task text] -- <senten command>');const agent=store.getAgent(id);if(!agent)throw new Error(`Agent not found: ${id}`);const sep=args.indexOf('--');if(sep<0||!args[sep+1])throw new Error('Agent execution requires -- <senten command>');const command=args[sep+1]!,commandArgs=args.slice(sep+2);const capability=commandCapability(command);const decision=permissionDecision(agent,capability,commandArgs[0]);const runId=`arun_${randomUUID().slice(0,8)}`;const task=flagValue(args.slice(0,sep),'--task');const before=new Set(store.listOperations().map(o=>o.id));const context=await generateContext(cwd,task??`${command} ${commandArgs.join(' ')}`,agent);await saveContextArtifact(cwd,context);const run:AgentRunRecord={id:runId,agentId:id,...(task?{task}:{}),command,args:commandArgs,startedAt:new Date().toISOString(),status:decision.allowed?'running':'denied',contextBundleId:context.id,operationIds:[]};store.putAgentRun(run);if(!decision.allowed){store.putAgentRun({...run,endedAt:new Date().toISOString(),status:'denied',error:decision.reason});throw new Error(`Agent ${id} denied ${capability}: ${decision.reason}`);}store.close();let error:string|undefined;try{await main([command,...commandArgs,'--actor',`agent:${id}`]);}catch(e){error=e instanceof Error?e.message:String(e);}const finalStore=await LocalStateStore.open(cwd);try{const created=finalStore.listOperations().filter(o=>!before.has(o.id)).map(o=>o.id);const final:AgentRunRecord={...run,endedAt:new Date().toISOString(),status:error?'failed':'passed',operationIds:created,...(error?{error}:{})};finalStore.putAgentRun(final);console.log(`AGENT RUN ${final.status.toUpperCase()} ${final.id}\nAgent      ${id}\nCapability ${capability}\nContext    ${context.id}\nOperations ${created.length}`);if(error)throw new Error(error);}finally{finalStore.close();}}finally{try{store.close();}catch{}}
}

async function contextCommand(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const task=flagValue(args,'--task')??args.filter(a=>!a.startsWith('--')).join(' ');if(!task)throw new Error('Usage: senten context --task <task> [--agent id] [--json]');const agentId=flagValue(args,'--agent');const store=await LocalStateStore.open(cwd);let agent:AgentProfile|undefined;try{if(agentId){agent=store.getAgent(agentId);if(!agent)throw new Error(`Agent not found: ${agentId}`);}}finally{store.close();}const bundle=await generateContext(cwd,task,agent);await saveContextArtifact(cwd,bundle);if(args.includes('--json'))return console.log(JSON.stringify(bundle,null,2));console.log(`TASK CONTEXT ${bundle.id}\nTask        ${bundle.task}\nSemantic    ${bundle.semantic.nodes.length} nodes / ${bundle.semantic.edges.length} edges\nMemory      ${bundle.memory.length}\nOperations  ${bundle.recentOperations.length}\nConstraints ${bundle.constraints.length}\nDigest      ${bundle.sourceDigest}`);}

async function generateContext(cwd:string,task:string,agent?:AgentProfile):Promise<TaskContextBundle>{const ir=await loadIR(cwd);const store=await LocalStateStore.open(cwd);try{const bundle=buildTaskContext({task,...(agent?{agent}:{}),ir,memory:store.listMemory(),operations:store.listOperations()});const bindingPath=join(cwd,'.senten','git-binding.json');let gitBinding:unknown=undefined;if(await exists(bindingPath)){try{gitBinding=JSON.parse(await readFile(bindingPath,'utf8'));}catch{}}return{...bundle,metadata:{...(bundle.metadata??{}),...(gitBinding?{gitBinding}:{}),contextPolicy:'project-scoped; credentials excluded'}};}finally{store.close();}}
async function saveContextArtifact(cwd:string,bundle:TaskContextBundle):Promise<void>{const dir=join(cwd,'.senten','artifacts','contexts');await mkdir(dir,{recursive:true});await writeFile(join(dir,`${bundle.id}.json`),JSON.stringify(bundle,null,2)+'\n');}

function commandsCommand(registry:ExtensionRegistry,args:string[]):void{const rows:Array<{name:string;capability:string;source:string}>=CORE_COMMANDS.map(name=>({name,capability:commandCapability(name),source:'core'}));for(const ext of registry.list())for(const c of ext.commands??[])rows.push({name:`${ext.namespace} ${c.path}`,capability:c.capability??ext.capabilities[0]??`extension.${ext.namespace}`,source:ext.namespace});if(args.includes('--json')||flagValue(args,'--format')==='json')console.log(JSON.stringify(rows,null,2));else for(const r of rows)console.log(`${r.name.padEnd(32)} ${r.capability.padEnd(24)} ${r.source}`);}
async function mcpCommand(registry:ExtensionRegistry,args:string[]):Promise<void>{
  const action=args[0]??'schema';
  const core=['inspect','explain','why','graph','impact','adopt','declare','relate','lineage','discover','drift','source','diff','paths','doctor','proof','guarantee','capability','simulate','compatibility','runtime','evidence','assurance','launchproof','context','workflow','sandbox','crawl','clickthru','journey'];
  const safeRead=new Set(['inspect','explain','why','graph','impact','lineage','drift','source','diff','paths','doctor','proof','guarantee','compatibility']);
  const commands=core.map(name=>({name,description:`Senten ${name} operation`,capability:commandCapability(name),mutating:!safeRead.has(name)}));
  for(const ext of registry.list())for(const c of ext.commands??[])commands.push({name:`${ext.namespace}_${c.path}`,description:c.description??`${ext.namespace} ${c.path}`,capability:c.capability??ext.capabilities[0]??`extension.${ext.namespace}`,mutating:true});
  const tools=buildMcpToolDefinitions(commands);
  if(action==='schema'){console.log(JSON.stringify({schemaVersion:'0.2',protocol:'MCP',transport:'stdio',defaultPolicy:'read-only',tools},null,2));return;}
  if(action==='serve'){
    const entrypoint=process.argv[1];if(!entrypoint)throw new Error('Unable to resolve Senten CLI entrypoint for MCP transport.');
    const allowWrite=args.includes('--allow-write');const timeoutMs=parseDurationMs(flagValue(args,'--timeout'))??30_000;const maxOutputBytes=parseSize(flagValue(args,'--max-output')??'1mb');
    await runMcpStdioServer({cwd:process.cwd(),entrypoint,tools,allowWrite,allowLiveEffects:args.includes('--allow-live-effects'),timeoutMs,maxOutputBytes});return;
  }
  throw new Error('Usage: senten mcp <schema|serve> [--allow-write] [--allow-live-effects] [--timeout 30s] [--max-output 1mb]');
}

async function makeOperation(cwd:string,input:{action:string;intent:string;targets:string[];dryRun:boolean;rollback:RollbackRecipe;reversibility:OperationRecord['reversibility'];actor:ActorIdentity}):Promise<OperationRecord>{const store=await LocalStateStore.open(cwd);try{const sessionId=store.get('session.active'); const transactionId=store.get('transaction.active'); const branch=gitBranch(cwd); const commit=gitCommit(cwd); return{id:`op_${randomUUID().slice(0,8)}`,timestamp:new Date().toISOString(),actor:input.actor,intent:input.intent,action:input.action,targets:input.targets,environment:(await loadConfig(cwd)).environment??'development',dryRun:input.dryRun,status:input.dryRun?'planned':'applied',reversibility:input.reversibility,rollback:input.rollback,...(sessionId?{sessionId}:{}),...(transactionId?{transactionId}:{}),...(branch?{branch}:{}),...(commit?{gitCommit:commit}:{})};}finally{store.close();}}
async function recordOperation(cwd:string,op:OperationRecord):Promise<void>{const store=await LocalStateStore.open(cwd);try{store.putOperation(op);store.appendEvent(eventFor(op.dryRun?'operation.planned':'operation.applied',op.id,op.actor));if(op.transactionId){const tx=store.getTransaction(op.transactionId);if(tx)store.putTransaction({...tx,operationIds:[...tx.operationIds,op.id]});}}finally{store.close();}}
function eventFor(type:OperationEvent['type'],operationId:string,actor:ActorIdentity,extras:{inverseOf?:string;replays?:string;metadata?:Record<string,unknown>}={}):OperationEvent{return{id:`evt_${randomUUID().slice(0,8)}`,type,timestamp:new Date().toISOString(),actor,operationId,...extras};}
async function undoOne(cwd:string,store:LocalStateStore,op:OperationRecord,actor:ActorIdentity):Promise<void>{if(!op.rollback||op.rollback.type==='none')throw new Error(`Operation ${op.id} is not reversible: ${op.rollback?.type==='none'?op.rollback.reason:'no rollback recipe'}`);await applyRollback(cwd,op.rollback);store.appendEvent(eventFor('operation.undone',op.id,actor,{inverseOf:op.id}));}
async function executeUndoBatch(cwd:string,store:LocalStateStore,ops:OperationRecord[],actor:ActorIdentity):Promise<void>{
  const changed:OperationRecord[]=[];const undoBatchId=`undo_${randomUUID().slice(0,8)}`;
  try{for(const op of ops){if(!op.rollback||op.rollback.type==='none')throw new Error(`Operation ${op.id} is not reversible.`);await applyRollback(cwd,op.rollback);changed.push(op);}}
  catch(error){for(const op of changed.slice().reverse()){try{await replayOperation(cwd,op);}catch(recovery){throw new Error(`Rollback failed and recovery also failed after ${op.id}: ${String(recovery)}`,{cause:error instanceof Error?error:undefined});}}throw error;}
  for(const op of ops)store.appendEvent(eventFor('operation.undone',op.id,actor,{inverseOf:op.id,metadata:{undoBatchId}}));
  console.log(`UNDO BATCH ${undoBatchId}`);
}

async function replayOperation(cwd:string,op:OperationRecord):Promise<void>{if(op.action==='create'){const path=resolveElementPath(cwd,op.targets[0]!);if(await exists(path))throw new Error(`Redo target exists: ${op.targets[0]}`);if(op.rollback?.type==='delete-created'&&op.rollback.expectedHash===undefined)await mkdir(path,{recursive:true});else{await mkdir(dirname(path),{recursive:true});await writeFile(path,'');}return;}if(op.action==='copy'){const [from,to]=op.targets.map(t=>resolveElementPath(cwd,t));if(!from||!to||!await exists(from)||await exists(to))throw new Error('Redo preconditions failed for copy.');const info=await stat(from);if(info.isDirectory())await cp(from,to,{recursive:true,errorOnExist:true});else await copyFile(from,to);return;}if(op.action==='move'||op.action==='rename'){const [from,to]=op.targets.map(t=>resolveElementPath(cwd,t));if(!from||!to||!await exists(from)||await exists(to))throw new Error('Redo preconditions failed for move/rename.');await mkdir(dirname(to),{recursive:true});await rename(from,to);return;}if(op.action==='delete'){const path=resolveElementPath(cwd,op.targets[0]!);if(!await exists(path))throw new Error('Redo delete target is already absent.');await rm(path);return;}throw new Error(`Redo not implemented for action ${op.action}`);}
function latestUndoBatch(store:LocalStateStore):{id:string;operationIds:string[]}|undefined{
  const events=store.listEvents();let id:string|undefined;for(const event of events.slice().reverse()){const candidate=typeof event.metadata?.undoBatchId==='string'?event.metadata.undoBatchId:undefined;if(candidate){id=candidate;break;}}
  if(!id)return undefined;return{id,operationIds:events.filter(e=>e.metadata?.undoBatchId===id&&e.type==='operation.undone').map(e=>e.operationId)};
}
function hasExplicitSelectors(args:string[]):boolean{return ['--actor','--session','--transaction','--since','--today'].some(x=>args.includes(x));}
async function buildRedoPlan(cwd:string,store:LocalStateStore,ops:OperationRecord[]):Promise<{ops:OperationRecord[];blocked:string[];conflicts:string[]}>{
  const blocked:string[]=[];const conflicts:string[]=[];
  for(const op of ops){
    try{await checkReplayPreconditions(cwd,op);}catch(error){blocked.push(`${op.id}: ${error instanceof Error?error.message:String(error)}`);}
    for(const current of store.listOperations())if(current.id!==op.id&&store.currentOperationState(current.id)==='applied'&&new Date(current.timestamp)>new Date(op.timestamp)&&current.targets.some(t=>op.targets.some(base=>pathsOverlap(base,t))))conflicts.push(`${op.id}: newer applied operation ${current.id} touches the same elements`);
  }
  return{ops,blocked,conflicts:[...new Set(conflicts)]};
}
function printRedoPlan(plan:{ops:OperationRecord[];blocked:string[];conflicts:string[]},undoBatchId?:string):void{console.log(`REDO PLAN${undoBatchId?` — ${undoBatchId}`:''}\nSelected   ${plan.ops.length}\nBlocked    ${plan.blocked.length}\nConflicts  ${plan.conflicts.length}`);for(const op of plan.ops)console.log(`  ${op.id} ${op.action} ${op.targets.join(' -> ')}`);for(const x of plan.blocked)console.log(`  ! ${x}`);for(const x of plan.conflicts)console.log(`  ! ${x}`);}
async function checkReplayPreconditions(cwd:string,op:OperationRecord):Promise<void>{
  if(op.action==='create'){const path=resolveElementPath(cwd,op.targets[0]!);if(await exists(path))throw new Error(`target exists ${op.targets[0]}`);return;}
  if(op.action==='copy'){const from=resolveElementPath(cwd,op.targets[0]!),to=resolveElementPath(cwd,op.targets[1]!);if(!await exists(from))throw new Error(`copy source missing ${op.targets[0]}`);if(await exists(to))throw new Error(`copy destination exists ${op.targets[1]}`);return;}
  if(op.action==='move'||op.action==='rename'){const from=resolveElementPath(cwd,op.targets[0]!),to=resolveElementPath(cwd,op.targets[1]!);if(!await exists(from))throw new Error(`source missing ${op.targets[0]}`);if(await exists(to))throw new Error(`destination exists ${op.targets[1]}`);return;}
  if(op.action==='delete'){const path=resolveElementPath(cwd,op.targets[0]!);if(!await exists(path))throw new Error(`delete target absent ${op.targets[0]}`);return;}
  throw new Error(`redo unsupported for ${op.action}`);
}
async function buildUndoPlan(cwd:string,store:LocalStateStore,ops:OperationRecord[]):Promise<{ops:OperationRecord[];irreversible:OperationRecord[];conflicts:string[]}>{const irreversible=ops.filter(o=>o.reversibility==='irreversible'||!o.rollback||o.rollback.type==='none');const conflicts:string[]=[];for(const op of ops){for(const t of op.targets){const p=resolveElementPath(cwd,t);if(op.rollback?.type==='move'&&!await exists(resolveElementPath(cwd,op.rollback.from)))conflicts.push(`${op.id}: rollback source missing ${op.rollback.from}`);if(op.rollback?.type==='delete-created'&&await exists(p)&&op.rollback.expectedHash){const current=await hashPath(p);if(current!==op.rollback.expectedHash)conflicts.push(`${op.id}: created target changed since operation ${t}`);}}}return{ops,irreversible,conflicts};}
function printUndoPlan(plan:{ops:OperationRecord[];irreversible:OperationRecord[];conflicts:string[]}):void{console.log(`UNDO PLAN\nSelected      ${plan.ops.length}\nIrreversible  ${plan.irreversible.length}\nConflicts     ${plan.conflicts.length}`);for(const op of plan.ops)console.log(`  ${op.id} ${op.action} ${op.targets.join(' -> ')}`);for(const c of plan.conflicts)console.log(`  ! ${c}`);}
function findLaterConflicts(store:LocalStateStore,target:OperationRecord):OperationRecord[]{const all=store.listOperations();const idx=all.findIndex(o=>o.id===target.id);return all.slice(idx+1).filter(o=>store.currentOperationState(o.id)==='applied'&&o.targets.some(t=>target.targets.some(base=>pathsOverlap(base,t))));}
function selectOperations(store:LocalStateStore,args:string[]):OperationRecord[]{return store.listOperations().filter(op=>matchesSelectors(op,args));}
function matchesSelectors(op:OperationRecord,args:string[]):boolean{const actor=flagValue(args,'--actor');if(actor&&`${op.actor.type}:${op.actor.id}`!==actor&&op.actor.id!==actor)return false;const session=flagValue(args,'--session');if(session&&op.sessionId!==session)return false;const tx=flagValue(args,'--transaction');if(tx&&op.transactionId!==tx)return false;const since=flagValue(args,'--since');if(since&&new Date(op.timestamp)<resolveSince(since))return false;if(args.includes('--today')){const now=new Date(),d=new Date(op.timestamp);if(d.getFullYear()!==now.getFullYear()||d.getMonth()!==now.getMonth()||d.getDate()!==now.getDate())return false;}return true;}
function pathsOverlap(a:string,b:string):boolean{const na=a.replaceAll('\\','/').replace(/\/$/,'');const nb=b.replaceAll('\\','/').replace(/\/$/,'');return na===nb||na.startsWith(`${nb}/`)||nb.startsWith(`${na}/`);}
function resolveSince(value:string):Date{if(/^\d+(m|h|d)$/.test(value)){const n=Number(value.slice(0,-1)),u=value.at(-1)!;const ms=u==='m'?n*60000:u==='h'?n*3600000:n*86400000;return new Date(Date.now()-ms);}const d=new Date(value);if(Number.isNaN(d.valueOf()))throw new Error(`Invalid --since value: ${value}`);return d;}
async function applyRollback(cwd:string,rollback:RollbackRecipe):Promise<void>{if(rollback.type==='move'){const from=resolveElementPath(cwd,rollback.from),to=resolveElementPath(cwd,rollback.to);if(!await exists(from))throw new Error(`Rollback source no longer exists: ${rollback.from}`);if(await exists(to))throw new Error(`Rollback destination already exists: ${rollback.to}`);await mkdir(dirname(to),{recursive:true});await rename(from,to);return;}if(rollback.type==='delete-created'){const path=resolveElementPath(cwd,rollback.path);if(!await exists(path))return;if(rollback.expectedHash&&await hashPath(path)!==rollback.expectedHash)throw new Error(`Refusing rollback because ${rollback.path} changed since creation.`);await rm(path,{recursive:true,force:true});return;}if(rollback.type==='restore-file'){const path=resolveElementPath(cwd,rollback.path);if(await exists(path))throw new Error(`Refusing to overwrite existing file during rollback: ${rollback.path}`);await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(rollback.contentBase64,'base64'));}}


async function adoptCommand(cwd:string,args:string[]):Promise<void>{
  if(!await exists(join(cwd,'senten.config.json')))await initProject(cwd,[]); let ir=await loadIR(cwd);
  if(!args.includes('--no-discover')){const discovered=await discoverSourceProject(cwd,ir.application,ir,{force:args.includes('--force'),analyzers:defaultRegistry().sourceAnalyzers()}); const manualNodes=ir.nodes.filter(n=>n.metadata?.discoveredBy!=='source-intelligence'); const manualEdges=ir.edges.filter(e=>e.metadata?.discoveredBy!=='source-intelligence'); ir={...discovered.ir,nodes:[...manualNodes,...discovered.ir.nodes.filter(n=>!manualNodes.some(m=>m.id===n.id))],edges:[...manualEdges,...discovered.ir.edges]}; await writeIR(cwd,ir);}
  const report=await analyzeAdoption(cwd,ir); await mkdir(join(cwd,'.senten','artifacts'),{recursive:true}); const out=join(cwd,'.senten','artifacts','adoption-report.json'); await writeFile(out,JSON.stringify(report,null,2)+'\n');
  if(args.includes('--json'))return console.log(JSON.stringify(report,null,2));
  console.log(`SENTEN ADOPT\nApplication   ${report.application.name}\nReadiness     ${report.readiness.status} (${report.readiness.score}/100)\nWorkspace     ${report.workspace.kind}${report.workspace.packageManager?` / ${report.workspace.packageManager}`:''}\nSemantic      ${report.coverage.semantic}%\nOperational   ${report.coverage.operational}%\nFiles         ${report.summary.files}\nRoutes        ${report.summary.routes}\nActions       ${report.summary.actions}\nResources     ${report.summary.resources}\nProviders     ${report.summary.providers}\nTests         ${report.summary.tests}\nSignals       ${report.signals.length}\nGaps          ${report.gaps.length}\nArtifact      ${relative(cwd,out)}`);
  if(report.signals.length){console.log('\nSignals');for(const x of report.signals)console.log(`  ${x.category.padEnd(11)} ${x.label} [${x.confidence}]`);} if(report.gaps.length){console.log('\nAdoption gaps');for(const x of report.gaps)console.log(`  ${x.severity.toUpperCase().padEnd(8)} ${x.message}`);} if(report.recommendations.length){console.log('\nNext architecture work');for(const x of report.recommendations)console.log(`  - ${x}`);}
  if(args.includes('--strict')&&report.gaps.some(g=>g.severity==='critical'))process.exitCode=1;
}


async function declareCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const kind=args[0] as SemanticNode['kind']|undefined; const rawId=args[1]; if(!kind||!rawId)throw new Error('Usage: senten declare <resource|action|policy|invariant|capability|event|state|feature|actor|provider> <id> [--label text] [--source file]');
  const allowed:SemanticNode['kind'][]=['resource','action','policy','invariant','capability','event','state','feature','actor','provider','query','effect','ui']; if(!allowed.includes(kind))throw new Error(`Unsupported declarative semantic kind: ${kind}`);
  const id=rawId.startsWith(`${kind}:`)?rawId:`${kind}:${rawId}`; const ir=await loadIR(cwd); if(ir.nodes.some(n=>n.id===id))throw new Error(`Semantic node already exists: ${id}`); const label=flagValue(args,'--label')??rawId; const source=flagValue(args,'--source'); const node:SemanticNode={id,kind,label,...(source?{source}:{}),metadata:{declaredBy:'senten-cli',declaredAt:new Date().toISOString()}}; ir.nodes.push(node); ir.generatedAt=new Date().toISOString(); await writeIR(cwd,ir); console.log(`DECLARED ${id}\nLabel   ${label}${source?`\nSource  ${source}`:''}`);
}

async function relateCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const [fromRaw,relation,toRaw]=args; if(!fromRaw||!relation||!toRaw)throw new Error('Usage: senten relate <from> <relation> <to>'); const ir=await loadIR(cwd); const from=resolveSemanticRef(fromRaw,ir.nodes),to=resolveSemanticRef(toRaw,ir.nodes); if(!ir.nodes.some(n=>n.id===from))throw new Error(`Unknown semantic source: ${fromRaw}`); if(!ir.nodes.some(n=>n.id===to))throw new Error(`Unknown semantic target: ${toRaw}`); if(ir.edges.some(e=>e.from===from&&e.to===to&&e.relation===relation)){console.log(`RELATION EXISTS ${from} --${relation}--> ${to}`);return;} ir.edges.push({from,to,relation,metadata:{declaredBy:'senten-cli',declaredAt:new Date().toISOString()}}); ir.generatedAt=new Date().toISOString(); await writeIR(cwd,ir); console.log(`RELATED ${from} --${relation}--> ${to}`);
}

async function whyCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const target=args[0]; if(!target)throw new Error('Usage: senten why <element>'); const ir=await loadIR(cwd); const id=resolveSemanticRef(target,ir.nodes); const node=ir.nodes.find(n=>n.id===id); if(!node)throw new Error(`Semantic element not found: ${target}`);
  const incoming=ir.edges.filter(e=>e.to===id); const outgoing=ir.edges.filter(e=>e.from===id); const relatedMemory=await (async()=>{const store=await LocalStateStore.open(cwd);try{return store.listMemory().filter(m=>m.subject===id||m.subject===target||m.value.includes(id)).slice(-10);}finally{store.close();}})();
  if(args.includes('--json'))return console.log(JSON.stringify({node,incoming,outgoing,memory:relatedMemory},null,2));
  console.log(`WHY ${id}\nKind    ${node.kind}\nLabel   ${node.label??'-'}\nSource  ${node.source??'-'}\n\nIncoming`); if(!incoming.length)console.log('  none'); for(const e of incoming)console.log(`  ${e.from} --${e.relation}--> ${e.to}`); console.log('\nOutgoing'); if(!outgoing.length)console.log('  none'); for(const e of outgoing)console.log(`  ${e.from} --${e.relation}--> ${e.to}`); if(relatedMemory.length){console.log('\nDecisions / memory');for(const m of relatedMemory)console.log(`  ${m.kind}:${m.subject??'-'} ${m.value}`);}
}


async function lineageCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd);const target=args[0];if(!target)throw new Error('Usage: senten lineage <element> [--depth N] [--json]');const ir=await loadIR(cwd);const root=resolveSemanticRef(target,ir.nodes);if(!ir.nodes.some(n=>n.id===root))throw new Error(`Semantic element not found: ${target}`);const maxDepth=Math.max(1,Math.min(12,Number(flagValue(args,'--depth')??4)));const preferred=new Set(['reads','writes','requires','preserves','emits','consumes','produces','uses','uses-package','dispatches','implemented-by','defined-in']);const visited=new Set([root]);let frontier=[root];const paths:Array<{depth:number;from:string;relation:string;to:string;direction:'out'|'in'}>=[];for(let depth=1;depth<=maxDepth&&frontier.length;depth++){const next:string[]=[];for(const current of frontier){for(const e of ir.edges){if(!preferred.has(e.relation))continue;let candidate:string|undefined,direction:'out'|'in'|undefined;if(e.from===current){candidate=e.to;direction='out';}else if(e.to===current){candidate=e.from;direction='in';}if(!candidate||visited.has(candidate)||!direction)continue;visited.add(candidate);next.push(candidate);paths.push({depth,from:e.from,relation:e.relation,to:e.to,direction});}}frontier=next;}const result={root,maxDepth,paths,nodes:[...visited].map(id=>ir.nodes.find(n=>n.id===id)).filter(Boolean)};if(args.includes('--json'))return console.log(JSON.stringify(result,null,2));console.log(`LINEAGE ${root}\nDepth ${maxDepth}\nReach  ${visited.size-1}`);for(const p of paths)console.log(`  ${'  '.repeat(p.depth-1)}${p.from} --${p.relation}--> ${p.to}`);
}

interface StoredCapabilityConfig { providers:CapabilityProvider[]; budgets:Record<string,OperationalBudget>; }
async function loadCapabilityConfig(cwd:string):Promise<StoredCapabilityConfig>{const path=join(cwd,'.senten','capabilities.json');if(!await exists(path))return{providers:[],budgets:{}};return JSON.parse(await readFile(path,'utf8')) as StoredCapabilityConfig;}
async function saveCapabilityConfig(cwd:string,value:StoredCapabilityConfig):Promise<void>{await mkdir(join(cwd,'.senten'),{recursive:true});await writeFile(join(cwd,'.senten','capabilities.json'),JSON.stringify(value,null,2)+'\n');}
async function capabilityCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const action=args[0]??'list'; const cfg=await loadCapabilityConfig(cwd);
  if(action==='register'){const capability=args[1],id=args[2];if(!capability||!id)throw new Error('Usage: senten capability register <capability> <provider> [--priority N]');if(cfg.providers.some(p=>p.capability===capability&&p.id===id))throw new Error(`Provider already registered: ${capability}/${id}`);cfg.providers.push({capability,id,priority:Number(flagValue(args,'--priority')??0),metadata:{configuredBy:'senten-cli'}});await saveCapabilityConfig(cwd,cfg);console.log(`REGISTERED ${capability} -> ${id}`);return;}
  if(action==='budget'){const capability=args[1];if(!capability)throw new Error('Usage: senten capability budget <capability> [--latency-ms N] [--calls N] [--cost-usd N] [--tokens N]');const b:OperationalBudget={};const lat=flagValue(args,'--latency-ms'),calls=flagValue(args,'--calls'),cost=flagValue(args,'--cost-usd'),tokens=flagValue(args,'--tokens');if(lat)b.maxLatencyMs=Number(lat);if(calls)b.maxCalls=Number(calls);if(cost)b.maxCostUsd=Number(cost);if(tokens)b.maxTokens=Number(tokens);cfg.budgets[capability]=b;await saveCapabilityConfig(cwd,cfg);console.log(`BUDGET ${capability} ${JSON.stringify(b)}`);return;}
  if(action==='check'){const capability=args[1];if(!capability)throw new Error('Usage: senten capability check <capability> [usage flags]');const registry=new CapabilityRegistry();for(const p of cfg.providers)registry.register(p);const selected=await registry.select(capability);const usage:BudgetUsage={};const lat=flagValue(args,'--latency-ms'),calls=flagValue(args,'--calls'),cost=flagValue(args,'--cost-usd'),tokens=flagValue(args,'--tokens');if(lat)usage.latencyMs=Number(lat);if(calls)usage.calls=Number(calls);if(cost)usage.costUsd=Number(cost);if(tokens)usage.tokens=Number(tokens);const budget=evaluateBudget(cfg.budgets[capability]??{},usage);console.log(`CAPABILITY ${capability}\nStatus    ${selected.status}\nProvider  ${selected.provider?.id??'-'}\nReason    ${selected.reason}\nBudget    ${budget.ok?'PASS':'FAIL'}`);for(const v of budget.violations)console.log(`  ! ${v}`);if(selected.status==='unavailable'||!budget.ok)process.exitCode=1;return;}
  if(args.includes('--json'))return console.log(JSON.stringify(cfg,null,2));console.log('CAPABILITIES');if(!cfg.providers.length)console.log('  none registered');for(const p of cfg.providers)console.log(`  ${p.capability.padEnd(16)} ${p.id} priority=${p.priority??0}${cfg.budgets[p.capability]?` budget=${JSON.stringify(cfg.budgets[p.capability])}`:''}`);
}

async function simulateCommand(cwd:string,args:string[]):Promise<void>{
  await requireInitialized(cwd); const action=args[0]; const dir=join(cwd,'.senten','simulations');
  if(action==='list'){
    if(!await exists(dir)){console.log('No simulation plans.');return;}
    const files=(await readdir(dir)).filter(x=>x.endsWith('.json')).sort();if(!files.length){console.log('No simulation plans.');return;}
    const rows=[] as Array<Record<string,unknown>>;for(const file of files){try{rows.push(JSON.parse(await readFile(join(dir,file),'utf8')) as Record<string,unknown>);}catch{}}
    if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));for(const row of rows)console.log(`${String(row.id??'unknown').padEnd(16)} ${String(row.fault??'unknown').padEnd(10)} ${String(row.target??'application')}  ${String(row.environment??'sandbox')}`);return;
  }
  if(action==='inspect'){
    const id=args[1];if(!id)throw new Error('Usage: senten simulate inspect <id>');const file=join(dir,`${id}.json`);if(!await exists(file))throw new Error(`Simulation plan not found: ${id}`);const plan=JSON.parse(await readFile(file,'utf8')) as Record<string,unknown>;if(args.includes('--json'))return console.log(JSON.stringify(plan,null,2));console.log(`SIMULATION PLAN ${plan.id}\nFault        ${plan.fault}\nTarget       ${plan.target}\nValue        ${plan.value??'-'}\nEnvironment  ${plan.environment}\nMode         ${plan.mode}\nCreated      ${plan.createdAt}\nSafety       isolated execution required`);return;
  }
  const fault=action; if(!fault)throw new Error('Usage: senten simulate <network|provider|latency|error|resource|list|inspect> [--target <element>] [--value <value>]'); const allowed=['network','provider','latency','error','resource'];if(!allowed.includes(fault))throw new Error(`Unsupported safe simulation fault: ${fault}`);const plan={id:`sim_${randomUUID().slice(0,10)}`,fault,target:flagValue(args,'--target')??'application',value:flagValue(args,'--value')??null,environment:flagValue(args,'--env')??'sandbox',createdAt:new Date().toISOString(),mode:'declarative',note:'This plan does not alter production. Execute only through an isolated sandbox provider.'};await mkdir(dir,{recursive:true});await writeFile(join(dir,`${plan.id}.json`),JSON.stringify(plan,null,2)+'\n');if(args.includes('--json'))return console.log(JSON.stringify(plan,null,2));console.log(`SIMULATION PLAN ${plan.id}\nFault        ${plan.fault}\nTarget       ${plan.target}\nEnvironment  ${plan.environment}\nMode         ${plan.mode}\nSafety       isolated execution required`);
}

async function compatibilityCommand(cwd:string,args:string[]):Promise<void>{await requireInitialized(cwd);const ir=await loadIR(cwd);const store=await LocalStateStore.open(cwd);let schema='unknown';try{schema=String(store.schemaVersion());}finally{store.close();}const report=compatibilityReport(ir,schema);if(args.includes('--json'))return console.log(JSON.stringify(report,null,2));console.log(`SENTEN COMPATIBILITY\nApplication IR      ${report.irSchema}\nIR support          ${report.supportedIrSchemas.join(', ')}\nCommand schema      ${report.contracts.commandSchema}\nExtension protocol  ${report.contracts.extensionProtocol}\nRegistry protocol   ${report.contracts.registryProtocol}\nState schema        ${report.contracts.stateSchema}\nResult              ${report.compatible?'PASS':'FAIL'}`);for(const w of report.warnings)console.log(`  ! ${w}`);if(!report.compatible)process.exitCode=1;}

async function inspectFsElement(cwd:string,path:string,raw:string):Promise<void>{if(!await exists(path))throw new Error(`Element does not exist: ${raw}`);const info=await stat(path);console.log(`ELEMENT\nTarget    ${raw}\nPath      ${relative(cwd,path)||'.'}\nKind      ${info.isDirectory()?'directory':'file'}\nSize      ${info.size}\nModified  ${info.mtime.toISOString()}`);}
async function normalizeDestination(cwd:string,source:string,destination:string):Promise<string>{const dest=resolveElementPath(cwd,destination);const explicitlyDirectory=destination.endsWith('/')||destination.endsWith('\\');if(explicitlyDirectory)return join(dest,basename(source));if(await exists(dest)){const info=await stat(dest);if(info.isDirectory())return join(dest,basename(source));}return dest;}
function resolveElementPath(cwd:string,id:string):string{const path=resolve(cwd,id),root=resolve(cwd),rel=relative(root,path);if(rel==='..'||rel.startsWith(`..${process.platform==='win32'?'\\':'/'}`))throw new Error('Element path escapes the project root.');return path;}
async function hashFile(path:string):Promise<string>{return sha256(await readFile(path));}
async function hashPath(path:string):Promise<string>{const info=await stat(path);if(info.isFile())return hashFile(path);const rows:string[]=[];async function walk(dir:string):Promise<void>{for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a:any,b:any)=>a.name.localeCompare(b.name))){const p=join(dir,entry.name);const rel=relative(path,p).replaceAll('\\','/');if(entry.isDirectory()){rows.push(`d:${rel}`);await walk(p);}else if(entry.isFile())rows.push(`f:${rel}:${await hashFile(p)}`);}}await walk(path);return sha256(Buffer.from(rows.join('\n')));}
function sha256(data:Buffer|string):string{return createHash('sha256').update(data).digest('hex');}
async function dirSize(path:string):Promise<number>{if(!await exists(path))return 0;let total=0;for(const e of await readdir(path,{withFileTypes:true})){const p=join(path,e.name);if(e.isDirectory())total+=await dirSize(p);else if(e.isFile())total+=(await stat(p)).size;}return total;}
async function requireInitialized(cwd:string):Promise<void>{if(!await exists(join(cwd,'senten.config.json')))throw new Error('Senten is not initialized. Run: senten init');}
async function loadIR(cwd:string):Promise<ApplicationIR>{const path=join(cwd,'.senten','state-truss.json');if(!await exists(path))throw new Error('Senten is not initialized. Run: senten init');return JSON.parse(await readFile(path,'utf8')) as ApplicationIR;}
async function writeIR(cwd:string,ir:ApplicationIR):Promise<void>{await mkdir(join(cwd,'.senten'),{recursive:true});await writeFile(join(cwd,'.senten','state-truss.json'),JSON.stringify(ir,null,2)+'\n');}
async function loadConfig(cwd:string):Promise<SentenConfig>{const path=join(cwd,'senten.config.json');if(!await exists(path))throw new Error('Senten is not initialized. Run: senten init');return JSON.parse(await readFile(path,'utf8')) as SentenConfig;}
async function saveConfig(cwd:string,config:SentenConfig):Promise<void>{await writeFile(join(cwd,'senten.config.json'),JSON.stringify(config,null,2)+'\n');}
async function findRegistryPackage(cwd:string,name:string):Promise<{manifest:Awaited<ReturnType<typeof loadPackage>>;path:string}|undefined>{const config=await loadConfig(cwd);for(const r of config.registries??[]){if(r.type!=='local')continue;const e=await new LocalRegistry({...r,location:resolve(cwd,r.location)}).find(name);if(e)return{manifest:e.manifest,path:e.path};}return undefined;}
async function migrateLegacyHistory(cwd:string,store:LocalStateStore):Promise<void>{const path=join(cwd,'.senten','history.jsonl');if(!await exists(path)||store.listOperations().length)return;const text=await readFile(path,'utf8');for(const line of text.split(/\r?\n/).filter(Boolean)){try{const old=JSON.parse(line) as Record<string,unknown>;const id=String(old.id??`op_${randomUUID().slice(0,8)}`);const actor=typeof old.actor==='string'?actorFromString(old.actor):{type:'human' as const,id:'legacy'};const op:OperationRecord={id,timestamp:String(old.timestamp??new Date().toISOString()),actor,intent:String(old.intent??'legacy operation'),action:String(old.action??'unknown'),targets:Array.isArray(old.targets)?old.targets.map(String):[],environment:String(old.environment??'development'),dryRun:Boolean(old.dryRun),status:old.status==='planned'?'planned':'applied',reversibility:old.rollback?'reversible':'irreversible',...(old.rollback?{rollback:old.rollback as RollbackRecipe}:{}),metadata:{migratedFrom:'history.jsonl'}};store.putOperation(op);const oldStatus=String(old.status??'applied');store.appendEvent(eventFor(oldStatus==='planned'?'operation.planned':'operation.applied',id,actor));if(oldStatus==='rolled-back')store.appendEvent(eventFor('operation.undone',id,{type:'system',id:'migration'},{inverseOf:id}));}catch{}}await appendFile(path,`# migrated to senten.db at ${new Date().toISOString()}\n`);}
function resolveSemanticRef(input:string,nodes:SemanticNode[]):string{if(nodes.some(n=>n.id===input))return input;const matches=nodes.filter(n=>n.id.endsWith(`:${input}`)||n.label===input);return matches.length===1?matches[0]!.id:input;}
function flagValue(args:string[],name:string):string|undefined{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;}
async function expireSandboxes(store:LocalStateStore):Promise<void>{for(const sbx of store.listSandboxes())if(sbx.status==='active'&&await expiredSandbox(sbx)){try{const p=await providerFor(sbx.provider);const h=await p.open(sbx);await h.destroy();}catch{}store.putSandbox({...sbx,status:'expired'});}}
function multiFlagValues(args:string[],flag:string):string[]{const out:string[]=[];for(let i=0;i<args.length;i++)if(args[i]===flag&&args[i+1])out.push(args[++i]!);return out;}
function parseDurationMs(value?:string):number|undefined{if(!value)return undefined;if(/^\d+$/.test(value))return Number(value);const m=value.match(/^(\d+)(ms|s|m|h|d)$/);if(!m)throw new Error(`Invalid duration: ${value}`);const n=Number(m[1]);return n*({ms:1,s:1000,m:60_000,h:3_600_000,d:86_400_000} as Record<string,number>)[m[2]!]!;}
function deviceViewport(value?:string):string|undefined{if(!value)return undefined;const presets:Record<string,string>={mobile:'390x844',tablet:'820x1180',desktop:'1440x900'};return presets[value.toLowerCase()];}
function parseViewport(value?:string):{width:number;height:number;label?:string}|undefined{if(!value)return undefined;const m=value.match(/^(\d+)x(\d+)$/i);if(!m)throw new Error(`Invalid viewport: ${value}. Use WIDTHxHEIGHT.`);return{width:Number(m[1]),height:Number(m[2])};}
function parseSize(value:string):number{const m=value.match(/^(\d+)(b|kb|mb)?$/i);if(!m)throw new Error(`Invalid size: ${value}`);const n=Number(m[1]),u=(m[2]??'b').toLowerCase();return n*(u==='mb'?1024*1024:u==='kb'?1024:1);}
function parseFlags(args:string[]):Record<string,string|boolean>{const flags:Record<string,string|boolean>={};for(let i=0;i<args.length;i++)if(args[i]!.startsWith('--')){const key=args[i]!.slice(2),next=args[i+1];flags[key]=next&&!next.startsWith('--')?next:true;if(typeof flags[key]==='string')i++;}return flags;}
function parseVars(args:string[]):Record<string,string>{const vars:Record<string,string>={};for(let i=0;i<args.length;i++)if(args[i]==='--var'&&args[i+1]){const [k,...rest]=args[i+1]!.split('=');if(k)vars[k]=rest.join('=');i++;}return vars;}
function positionalAfter(args:string[],start:number):string[]{const out:string[]=[];for(let i=start;i<args.length;i++){if(args[i]!.startsWith('--')){if(args[i+1]&&!args[i+1]!.startsWith('--'))i++;continue;}out.push(args[i]!);}return out;}
function actorFlag(args:string[]):ActorIdentity{return actorFromString(flagValue(args,'--actor')??'human:local');}
function slug(input:string):string{return input.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'app';}
function countBy<T>(items:T[],key:(item:T)=>string):Record<string,number>{const out:Record<string,number>={};for(const item of items)out[key(item)]=(out[key(item)]??0)+1;return out;}
function gitBranch(cwd:string):string|undefined{const r=spawnSync('git',['branch','--show-current'],{cwd,encoding:'utf8'});return r.status===0&&r.stdout.trim()?r.stdout.trim():undefined;}
function gitCommit(cwd:string):string|undefined{const r=spawnSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'});return r.status===0&&r.stdout.trim()?r.stdout.trim():undefined;}

async function scenarioCommand(cwd:string,args:string[]):Promise<void>{
  const action=args[0]??'list';
  if(action==='list'){
    const rows=await listScenarios(cwd);if(args.includes('--json'))return console.log(JSON.stringify(rows,null,2));
    console.log('SENTEN SCENARIO LAB');for(const row of rows)console.log(`${row.id.padEnd(30)} ${row.title}`);return;
  }
  if(action==='run'||action==='verify'){
    const id=args[1];if(!id)throw new Error('Usage: senten scenario run <id> [--json]');const result=await runScenario(cwd,id);
    if(args.includes('--json'))console.log(JSON.stringify(result,null,2));else{console.log(`SCENARIO ${result.scenario.id}\n${result.scenario.title}\nResult      ${result.passed?'PASS':'FAIL'}\nFrameworks  ${result.frameworks.join(', ')||'none'}\nReadiness   ${result.adoption.readiness.status} (${result.adoption.readiness.score}/100)\nNodes       ${result.ir.nodes.length}\nEdges       ${result.ir.edges.length}\nGaps        ${result.adoption.gaps.length}`);for(const f of result.failures)console.log(`  ! ${f}`);}
    if(!result.passed)process.exitCode=1;return;
  }
  if(action==='verify-all'){
    const rows=await listScenarios(cwd);let failed=0;for(const row of rows){const result=await runScenario(cwd,row.id);console.log(`${result.passed?'✓':'✕'} ${row.id}${result.failures.length?` — ${result.failures.join('; ')}`:''}`);if(!result.passed)failed++;}console.log(`Scenarios ${rows.length}\nPassed    ${rows.length-failed}\nFailed    ${failed}`);if(failed)process.exitCode=1;return;
  }
  if(action==='export'){
    const out=resolve(cwd,flagValue(args,'--output')??'apps/showcase/data');const result=await exportScenarioArtifacts(cwd,out);console.log(`SCENARIO ARTIFACTS\nScenarios ${result.count}\nFailed    ${result.failed}\nIndex     ${relative(cwd,result.index)}`);if(result.failed)process.exitCode=1;return;
  }
  throw new Error('Usage: senten scenario <list|run|verify-all|export>');
}

async function showcaseCommand(cwd:string,args:string[]):Promise<void>{
  const action=args[0]??'build';if(action!=='build')throw new Error('Usage: senten showcase build [--output showcase/data]');
  const out=resolve(cwd,flagValue(args,'--output')??'apps/showcase/data');const result=await exportScenarioArtifacts(cwd,out);
  console.log(`SENTEN SHOWCASE\nArtifacts  ${result.count}\nFailed     ${result.failed}\nOutput     ${relative(cwd,out)}\nMode       precomputed real Senten analysis`);if(result.failed)process.exitCode=1;
}

function suggestCommand(input:string,commands:string[]):string|undefined{let best:string|undefined,bestScore=Infinity;for(const c of commands){const d=levenshtein(input,c);if(d<bestScore){best=c;bestScore=d;}}return bestScore<=Math.max(2,Math.floor(input.length/3))?best:undefined;}
function levenshtein(a:string,b:string):number{const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diag=prev[0]!,left=i;prev[0]=i;for(let j=1;j<=b.length;j++){const up=prev[j]!;const next=Math.min(up+1,left+1,diag+(a[i-1]===b[j-1]?0:1));diag=up;prev[j]=next;left=next;}}return prev[b.length]!;}
function nodeAtLeast(major:number,minor:number):boolean{const [a,b]=process.versions.node.split('.').map(Number);return (a??0)>major||((a??0)===major&&(b??0)>=minor);}
async function exists(path:string):Promise<boolean>{try{await access(path,constants.F_OK);return true;}catch{return false;}}

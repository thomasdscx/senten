import type { ApplicationIR, EvidenceRecord, PackageKind, SemanticEdge, SemanticNode } from '../../core/src/index.js';
export type ExtensionKind = 'adapter' | 'integration';
export interface ExtensionCommandContext { cwd: string; args: string[]; flags: Record<string, string | boolean>; }
export interface ExtensionCommand { path: string; description: string; capability?:string; run(context: ExtensionCommandContext): Promise<number | void> | number | void; }
export interface ExtensionTemplateRegistration { name:string; description?:string; kind?:'template'|'blueprint'; path?:string; variables?:string[]; }
export interface ExtensionElementType { name:string; description?:string; creatable?:boolean; mutable?:boolean; }
export interface ExtensionSourceFileContext { path:string; content:string; language:string; imports:string[]; exports:string[]; projectFrameworks:string[]; }
export interface ApplicationIRFragmentSource {
  adapter: string;
  adapterVersion: string;
  analyzer?: string;
  files?: string[];
  confidence?: 'high'|'medium'|'low';
}
export interface ApplicationIRFragment {
  schemaVersion: '0.1';
  applicationId?: string;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  evidence?: EvidenceRecord[];
  diagnostics?: Array<{ level:'info'|'warning'|'error'; code:string; message:string; subject?:string }>;
  frameworkHints?: string[];
  source: ApplicationIRFragmentSource;
}
export interface ExtensionSourceContribution { nodes?:SemanticNode[]; edges?:SemanticEdge[]; frameworkHints?:string[]; fragment?:ApplicationIRFragment; }
export interface ExtensionSourceAnalyzer { name:string; analyze(context:ExtensionSourceFileContext):ExtensionSourceContribution|Promise<ExtensionSourceContribution>; }
export interface SentenExtension {
  name: string; namespace: string; version: string; kind: ExtensionKind; senten: string; capabilities: string[];
  commands?: ExtensionCommand[]; semanticTypes?: string[]; detectors?: string[]; hooks?: string[];
  templates?: ExtensionTemplateRegistration[]; elementTypes?: ExtensionElementType[]; skills?: string[]; packageKinds?: PackageKind[]; sourceAnalyzers?: ExtensionSourceAnalyzer[];
  compatibility?: { node?:string; frameworks?:Record<string,string> };
}

export interface IRFragmentValidation { ok:boolean; errors:string[]; warnings:string[]; }
export const APPLICATION_IR_FRAGMENT_LIMITS={nodes:50_000,edges:100_000,evidence:10_000,diagnostics:10_000} as const;
export function validateApplicationIRFragment(fragment:ApplicationIRFragment, application?:ApplicationIR['application']):IRFragmentValidation {
  const errors:string[]=[]; const warnings:string[]=[];
  if(fragment.schemaVersion!=='0.1')errors.push(`unsupported fragment schema: ${String(fragment.schemaVersion)}`);
  if(application&&fragment.applicationId&&fragment.applicationId!==application.id)errors.push(`fragment application mismatch: ${fragment.applicationId} != ${application.id}`);
  if(!fragment.source?.adapter?.trim())errors.push('fragment source.adapter is required');
  else if(!/^[a-z][a-z0-9._-]*$/.test(fragment.source.adapter))errors.push('fragment source.adapter must be a stable lowercase identifier');
  if(!fragment.source?.adapterVersion?.trim())errors.push('fragment source.adapterVersion is required');
  else if(!/^\d+\.\d+\.\d+/.test(fragment.source.adapterVersion))errors.push('fragment source.adapterVersion must begin with semver');
  if(fragment.nodes.length>APPLICATION_IR_FRAGMENT_LIMITS.nodes)errors.push(`fragment node limit exceeded: ${fragment.nodes.length}`);
  if(fragment.edges.length>APPLICATION_IR_FRAGMENT_LIMITS.edges)errors.push(`fragment edge limit exceeded: ${fragment.edges.length}`);
  if((fragment.evidence?.length??0)>APPLICATION_IR_FRAGMENT_LIMITS.evidence)errors.push(`fragment evidence limit exceeded: ${fragment.evidence?.length}`);
  if((fragment.diagnostics?.length??0)>APPLICATION_IR_FRAGMENT_LIMITS.diagnostics)errors.push(`fragment diagnostic limit exceeded: ${fragment.diagnostics?.length}`);
  const ids=new Set<string>();
  for(const node of fragment.nodes){if(!node.id?.trim())errors.push('fragment node id is required');if(ids.has(node.id))errors.push(`duplicate fragment node: ${node.id}`);ids.add(node.id);}
  for(const edge of fragment.edges){if(!edge.from?.trim()||!edge.to?.trim()||!edge.relation?.trim())errors.push('fragment edges require from, to, and relation');if(!ids.has(edge.from))warnings.push(`edge source is external to fragment: ${edge.from}`);if(!ids.has(edge.to))warnings.push(`edge target is external to fragment: ${edge.to}`);}
  return {ok:errors.length===0,errors,warnings};
}
export function defineApplicationIRFragment(fragment:ApplicationIRFragment):ApplicationIRFragment {
  const check=validateApplicationIRFragment(fragment);
  if(!check.ok)throw new Error(`Invalid Application IR fragment: ${check.errors.join('; ')}`);
  return fragment;
}
export interface ExtensionValidation { ok:boolean; errors:string[]; warnings:string[]; }
export function validateSentenExtension(extension:SentenExtension):ExtensionValidation {
  const errors:string[]=[]; const warnings:string[]=[];
  if(!/^[a-z][a-z0-9-]*$/.test(extension.namespace))errors.push('namespace must be lowercase kebab-case');
  if(!extension.name.trim())errors.push('name is required'); if(!/^\d+\.\d+\.\d+/.test(extension.version))errors.push('version must begin with semver');
  if(!extension.senten.trim())errors.push('senten compatibility range is required');
  const commands=new Set<string>(); for(const c of extension.commands??[]){if(commands.has(c.path))errors.push(`duplicate command: ${c.path}`);commands.add(c.path);if(!c.description)warnings.push(`command has no description: ${c.path}`);}
  const elementTypes=new Set<string>();for(const e of extension.elementTypes??[]){if(elementTypes.has(e.name))errors.push(`duplicate element type: ${e.name}`);elementTypes.add(e.name);}
  if(!extension.capabilities.length)warnings.push('extension declares no capabilities');
  return {ok:errors.length===0,errors,warnings};
}
export function defineSentenExtension(extension: SentenExtension): SentenExtension { const check=validateSentenExtension(extension); if(!check.ok)throw new Error(`Invalid Senten extension: ${check.errors.join('; ')}`); return extension; }
export class ExtensionRegistry {
  private readonly extensions = new Map<string, SentenExtension>();
  register(extension: SentenExtension): this { const check=validateSentenExtension(extension); if(!check.ok)throw new Error(`Invalid Senten extension ${extension.namespace}: ${check.errors.join('; ')}`); if (this.extensions.has(extension.namespace)) throw new Error(`Extension namespace already registered: ${extension.namespace}`); this.extensions.set(extension.namespace, extension); return this; }
  get(namespace: string): SentenExtension | undefined { return this.extensions.get(namespace); }
  list(): SentenExtension[] { return [...this.extensions.values()].sort((a,b) => a.namespace.localeCompare(b.namespace)); }
  command(namespace: string, path: string): ExtensionCommand | undefined { return this.get(namespace)?.commands?.find((command) => command.path === path); }
  sourceAnalyzers(): {namespace:string; analyzer:ExtensionSourceAnalyzer}[] { const out:{namespace:string;analyzer:ExtensionSourceAnalyzer}[]=[]; for(const ext of this.list())for(const analyzer of ext.sourceAnalyzers??[])out.push({namespace:ext.namespace,analyzer}); return out; }
  templates(namespace?:string): {namespace:string; template:ExtensionTemplateRegistration}[] { const out:{namespace:string;template:ExtensionTemplateRegistration}[]=[]; for(const ext of this.list()){if(namespace&&ext.namespace!==namespace)continue;for(const template of ext.templates??[])out.push({namespace:ext.namespace,template});}return out; }
}

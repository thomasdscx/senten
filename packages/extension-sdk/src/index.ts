import type { PackageKind, SemanticEdge, SemanticNode } from '../../core/src/index.js';
export type ExtensionKind = 'adapter' | 'integration';
export interface ExtensionCommandContext { cwd: string; args: string[]; flags: Record<string, string | boolean>; }
export interface ExtensionCommand { path: string; description: string; capability?:string; run(context: ExtensionCommandContext): Promise<number | void> | number | void; }
export interface ExtensionTemplateRegistration { name:string; description?:string; kind?:'template'|'blueprint'; path?:string; variables?:string[]; }
export interface ExtensionElementType { name:string; description?:string; creatable?:boolean; mutable?:boolean; }
export interface ExtensionSourceFileContext { path:string; content:string; language:string; imports:string[]; exports:string[]; }
export interface ExtensionSourceContribution { nodes?:SemanticNode[]; edges?:SemanticEdge[]; frameworkHints?:string[]; }
export interface ExtensionSourceAnalyzer { name:string; analyze(context:ExtensionSourceFileContext):ExtensionSourceContribution|Promise<ExtensionSourceContribution>; }
export interface SentenExtension {
  name: string; namespace: string; version: string; kind: ExtensionKind; senten: string; capabilities: string[];
  commands?: ExtensionCommand[]; semanticTypes?: string[]; detectors?: string[]; hooks?: string[];
  templates?: ExtensionTemplateRegistration[]; elementTypes?: ExtensionElementType[]; skills?: string[]; packageKinds?: PackageKind[]; sourceAnalyzers?: ExtensionSourceAnalyzer[];
  compatibility?: { node?:string; frameworks?:Record<string,string> };
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

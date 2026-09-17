import type { ApplicationIR, SemanticEdge, SemanticNode } from '../../core/src/index.js';
import type { ApplicationIRFragment } from '../../extension-sdk/src/index.js';
import { validateApplicationIRFragment } from '../../extension-sdk/src/index.js';

export interface IRMergeDiagnostic { level:'info'|'warning'|'error'; code:string; message:string; adapter?:string; subject?:string; }
export interface IRMergeResult { ir:ApplicationIR; diagnostics:IRMergeDiagnostic[]; fragments:number; }

function edgeKey(edge:SemanticEdge):string{return `${edge.from}\0${edge.relation}\0${edge.to}`;}
function provenanceFor(fragment:ApplicationIRFragment):Record<string,unknown>{return {adapter:fragment.source.adapter,adapterVersion:fragment.source.adapterVersion,analyzer:fragment.source.analyzer,confidence:fragment.source.confidence};}

export function mergeApplicationIRFragments(base:ApplicationIR, fragments:ApplicationIRFragment[]):IRMergeResult {
  const nodes=new Map(base.nodes.map(node=>[node.id,node] as const));
  const edges=new Map(base.edges.map(edge=>[edgeKey(edge),edge] as const));
  const diagnostics:IRMergeDiagnostic[]=[];
  const ordered=[...fragments].sort((a,b)=>`${a.source.adapter}@${a.source.adapterVersion}`.localeCompare(`${b.source.adapter}@${b.source.adapterVersion}`));
  for(const fragment of ordered){
    const check=validateApplicationIRFragment(fragment,base.application);
    for(const message of check.warnings)diagnostics.push({level:'warning',code:'fragment.validation.warning',message,adapter:fragment.source.adapter});
    if(!check.ok){for(const message of check.errors)diagnostics.push({level:'error',code:'fragment.validation.error',message,adapter:fragment.source.adapter});continue;}
    const fragmentIds=new Set(fragment.nodes.map(n=>n.id));
    for(const node of fragment.nodes){
      const existing=nodes.get(node.id);
      if(existing&&existing.kind!==node.kind){diagnostics.push({level:'error',code:'fragment.identity-collision',message:`${node.id}: ${existing.kind} vs ${node.kind}`,adapter:fragment.source.adapter,subject:node.id});continue;}
      const provenance=[...((existing?.metadata?.irFragmentProvenance as unknown[])??[]),provenanceFor(fragment)];
      if(existing){
        const semanticConflict=(existing.label&&node.label&&existing.label!==node.label)||(existing.source&&node.source&&existing.source!==node.source);
        if(semanticConflict)diagnostics.push({level:'warning',code:'fragment.semantic-conflict',message:`Preserved canonical identity for ${node.id}; adapter ${fragment.source.adapter} supplied differing label/source metadata.`,adapter:fragment.source.adapter,subject:node.id});
        nodes.set(node.id,{...node,...existing,metadata:{...node.metadata,...existing.metadata,irFragmentProvenance:provenance}});
      }else nodes.set(node.id,{...node,metadata:{...node.metadata,irFragmentProvenance:provenance}});
    }
    for(const edge of fragment.edges){
      if(!nodes.has(edge.from)||!nodes.has(edge.to)){diagnostics.push({level:'warning',code:'fragment.unresolved-edge',message:`${edge.from} -> ${edge.to}`,adapter:fragment.source.adapter});continue;}
      const key=edgeKey(edge);const existing=edges.get(key);const provenance=[...((existing?.metadata?.irFragmentProvenance as unknown[])??[]),provenanceFor(fragment)];
      edges.set(key,{...existing,...edge,metadata:{...existing?.metadata,...edge.metadata,irFragmentProvenance:provenance}});
    }
    for(const d of fragment.diagnostics??[])diagnostics.push({...d,adapter:fragment.source.adapter});
    diagnostics.push({level:'info',code:'fragment.merged',message:`Merged ${fragment.nodes.length} nodes and ${fragment.edges.length} edges`,adapter:fragment.source.adapter});
    if(fragmentIds.size===0)diagnostics.push({level:'warning',code:'fragment.empty',message:'Adapter emitted an empty IR fragment.',adapter:fragment.source.adapter});
  }
  return {ir:{...base,nodes:[...nodes.values()],edges:[...edges.values()],generatedAt:new Date().toISOString()},diagnostics,fragments:ordered.length};
}

export class StateTrussGraph {
  readonly nodes = new Map<string, SemanticNode>();
  readonly edges: SemanticEdge[] = [];

  constructor(public readonly application: ApplicationIR['application']) {}

  addNode(node: SemanticNode): this {
    const existing = this.nodes.get(node.id);
    if (existing && existing.kind !== node.kind) throw new Error(`Semantic identity collision: ${node.id} (${existing.kind} vs ${node.kind})`);
    this.nodes.set(node.id, { ...existing, ...node }); return this;
  }
  addEdge(edge: SemanticEdge): this {if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) throw new Error(`Edge references unknown node: ${edge.from} -> ${edge.to}`);this.edges.push(edge);return this;}
  get(id: string): SemanticNode | undefined { return this.nodes.get(id); }
  related(id: string, relation?: string): SemanticNode[] {const ids = new Set<string>();for (const edge of this.edges) {if (relation && edge.relation !== relation) continue;if (edge.from === id) ids.add(edge.to);if (edge.to === id) ids.add(edge.from);}return [...ids].map((nodeId) => this.nodes.get(nodeId)).filter((v): v is SemanticNode => Boolean(v));}
  impact(id: string, maxDepth = 3): { depth: number; node: SemanticNode; via: string }[] {const result: { depth: number; node: SemanticNode; via: string }[] = [];const visited = new Set([id]);let frontier = [id];for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {const next: string[] = [];for (const current of frontier) {for (const edge of this.edges) {let candidate: string | undefined;if (edge.from === current) candidate = edge.to;else if (edge.to === current) candidate = edge.from;if (!candidate || visited.has(candidate)) continue;visited.add(candidate);next.push(candidate);const node = this.nodes.get(candidate);if (node) result.push({ depth, node, via: edge.relation });}}frontier = next;}return result;}
  toIR(): ApplicationIR {return {schemaVersion: '0.1',application: this.application,nodes: [...this.nodes.values()],edges: [...this.edges],generatedAt: new Date().toISOString()};}
  static fromIR(ir: ApplicationIR): StateTrussGraph {const graph = new StateTrussGraph(ir.application);for (const node of ir.nodes) graph.addNode(node);for (const edge of ir.edges) graph.addEdge(edge);return graph;}
}

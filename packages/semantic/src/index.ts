import type { ApplicationIR, SemanticEdge, SemanticNode } from '../../core/src/index.js';

export class StateTrussGraph {
  readonly nodes = new Map<string, SemanticNode>();
  readonly edges: SemanticEdge[] = [];

  constructor(public readonly application: ApplicationIR['application']) {}

  addNode(node: SemanticNode): this {
    const existing = this.nodes.get(node.id);
    if (existing && existing.kind !== node.kind) {
      throw new Error(`Semantic identity collision: ${node.id} (${existing.kind} vs ${node.kind})`);
    }
    this.nodes.set(node.id, { ...existing, ...node });
    return this;
  }

  addEdge(edge: SemanticEdge): this {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error(`Edge references unknown node: ${edge.from} -> ${edge.to}`);
    }
    this.edges.push(edge);
    return this;
  }

  get(id: string): SemanticNode | undefined { return this.nodes.get(id); }

  related(id: string, relation?: string): SemanticNode[] {
    const ids = new Set<string>();
    for (const edge of this.edges) {
      if (relation && edge.relation !== relation) continue;
      if (edge.from === id) ids.add(edge.to);
      if (edge.to === id) ids.add(edge.from);
    }
    return [...ids].map((nodeId) => this.nodes.get(nodeId)).filter((v): v is SemanticNode => Boolean(v));
  }

  impact(id: string, maxDepth = 3): { depth: number; node: SemanticNode; via: string }[] {
    const result: { depth: number; node: SemanticNode; via: string }[] = [];
    const visited = new Set([id]);
    let frontier = [id];
    for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
      const next: string[] = [];
      for (const current of frontier) {
        for (const edge of this.edges) {
          let candidate: string | undefined;
          if (edge.from === current) candidate = edge.to;
          else if (edge.to === current) candidate = edge.from;
          if (!candidate || visited.has(candidate)) continue;
          visited.add(candidate);
          next.push(candidate);
          const node = this.nodes.get(candidate);
          if (node) result.push({ depth, node, via: edge.relation });
        }
      }
      frontier = next;
    }
    return result;
  }

  toIR(): ApplicationIR {
    return {
      schemaVersion: '0.1',
      application: this.application,
      nodes: [...this.nodes.values()],
      edges: [...this.edges],
      generatedAt: new Date().toISOString()
    };
  }

  static fromIR(ir: ApplicationIR): StateTrussGraph {
    const graph = new StateTrussGraph(ir.application);
    for (const node of ir.nodes) graph.addNode(node);
    for (const edge of ir.edges) graph.addEdge(edge);
    return graph;
  }
}

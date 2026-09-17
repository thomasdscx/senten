import type { ApplicationIR, SemanticEdge, SemanticNode } from '../../core/src/index.js';

export interface BlastRadiusPath { depth:number; node:SemanticNode; via:string; direction:'outbound'|'inbound'; from:string; to:string; }
export interface BlastRadiusReport {
  target:string;
  affected:number;
  maxDepth:number;
  risk:'low'|'medium'|'high'|'critical';
  riskScore:number;
  byKind:Record<string,number>;
  paths:BlastRadiusPath[];
  criticalSubjects:string[];
}

const RELATION_WEIGHT:Record<string,number>={
  'requires':5,'preserves':5,'writes':5,'deletes':5,'mutates':5,'dispatches':4,'invokes':4,'invokes-native':4,
  'reads':3,'uses':3,'implements-route':3,'depends-on':3,'provides':2,'contains':1,'imports':1,'uses-hook':1
};
const KIND_WEIGHT:Record<string,number>={policy:5,invariant:5,resource:4,route:4,action:4,provider:3,effect:3,event:2,test:1,file:1,module:1,symbol:1};

export function computeBlastRadius(ir:ApplicationIR,target:string,maxDepth=4):BlastRadiusReport{
  const nodes=new Map(ir.nodes.map(n=>[n.id,n] as const));
  if(!nodes.has(target))throw new Error(`Unknown semantic element: ${target}`);
  const depthLimit=Math.max(1,Math.min(12,Math.floor(maxDepth)||4));
  const visited=new Set([target]); let frontier=[target]; const paths:BlastRadiusPath[]=[];
  for(let depth=1;depth<=depthLimit&&frontier.length;depth++){
    const next:string[]=[];
    for(const current of frontier){
      for(const edge of ir.edges){
        let candidate:string|undefined; let direction:BlastRadiusPath['direction']='outbound';
        if(edge.from===current){candidate=edge.to;direction='outbound';}
        else if(edge.to===current){candidate=edge.from;direction='inbound';}
        if(!candidate||visited.has(candidate))continue;
        const node=nodes.get(candidate);if(!node)continue;
        visited.add(candidate);next.push(candidate);paths.push({depth,node,via:edge.relation,direction,from:edge.from,to:edge.to});
      }
    }
    frontier=next;
  }
  const byKind:Record<string,number>={};let score=0;const criticalSubjects:string[]=[];
  for(const p of paths){byKind[p.node.kind]=(byKind[p.node.kind]??0)+1;const relation=RELATION_WEIGHT[p.via]??2;const kind=KIND_WEIGHT[p.node.kind]??1;const proximity=Math.max(1,depthLimit-p.depth+1);score+=relation+kind+proximity;if(['policy','invariant','route','resource'].includes(p.node.kind))criticalSubjects.push(p.node.id);}
  score=Math.min(100,score);
  const risk=score>=70?'critical':score>=40?'high':score>=20?'medium':'low';
  return{target,affected:paths.length,maxDepth:depthLimit,risk,riskScore:score,byKind,paths,criticalSubjects:[...new Set(criticalSubjects)]};
}

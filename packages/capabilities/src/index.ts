export type StandardCapability='database'|'auth'|'storage'|'email'|'ai'|'payment'|'telemetry'|'search'|'queue'|'browser'|'custom';
export type CapabilityStatus='healthy'|'degraded'|'unavailable';
export interface OperationalBudget { maxLatencyMs?:number; maxCalls?:number; maxCostUsd?:number; maxTokens?:number; }
export interface BudgetUsage { latencyMs?:number; calls?:number; costUsd?:number; tokens?:number; }
export interface BudgetEvaluation { ok:boolean; violations:string[]; }
export interface CapabilityCallResult<T>{ value:T; usage:BudgetUsage; providerId:string; degraded:boolean; }
export interface CapabilityProvider<I=unknown,O=unknown> {
  id:string;
  capability:string;
  priority?:number;
  health?:()=>CapabilityStatus|Promise<CapabilityStatus>;
  execute?:(input:I,context:{signal?:AbortSignal;metadata?:Record<string,unknown>})=>O|Promise<O>;
  estimateUsage?:(input:I,output:O,elapsedMs:number)=>BudgetUsage;
  metadata?:Record<string,unknown>;
}
export interface CapabilitySelection { capability:string; provider?:CapabilityProvider; status:CapabilityStatus; reason:string; }

export class CapabilityRegistry {
  private providers=new Map<string,CapabilityProvider[]>();
  register(provider:CapabilityProvider):this{
    const list=this.providers.get(provider.capability)??[];
    if(list.some(p=>p.id===provider.id))throw new Error(`Duplicate provider ${provider.id} for ${provider.capability}`);
    list.push(provider); list.sort((a,b)=>(b.priority??0)-(a.priority??0)); this.providers.set(provider.capability,list); return this;
  }
  list(capability?:string):CapabilityProvider[]{return capability?[...(this.providers.get(capability)??[])]:[...this.providers.values()].flat();}
  async select(capability:string):Promise<CapabilitySelection>{
    const list=this.providers.get(capability)??[];
    for(const p of list){const status=await p.health?.()??'healthy';if(status==='healthy')return{capability,provider:p,status,reason:`selected ${p.id}`};}
    const degraded=list.find(Boolean);if(degraded)return{capability,provider:degraded,status:'degraded',reason:'no healthy provider; highest priority provider retained for explicit graceful degradation'};
    return{capability,status:'unavailable',reason:'no provider registered'};
  }
}

export class CapabilityRuntime {
  constructor(private readonly registry:CapabilityRegistry,private readonly budgets:Record<string,OperationalBudget>={}){}
  async execute<I,O>(capability:string,input:I,options:{allowDegraded?:boolean;signal?:AbortSignal;metadata?:Record<string,unknown>}={}):Promise<CapabilityCallResult<O>>{
    const selection=await this.registry.select(capability);
    if(!selection.provider||selection.status==='unavailable')throw new Error(`Capability unavailable: ${capability}`);
    if(selection.status==='degraded'&&!options.allowDegraded)throw new Error(`Capability degraded and fail-closed: ${capability} (${selection.provider.id})`);
    if(!selection.provider.execute)throw new Error(`Provider ${selection.provider.id} has no runtime executor`);
    const started=performance.now();
    const value=await selection.provider.execute(input,{...(options.signal?{signal:options.signal}:{}),...(options.metadata?{metadata:options.metadata}:{})}) as O;
    const elapsedMs=performance.now()-started;
    const usage=selection.provider.estimateUsage?.(input,value,elapsedMs)??{latencyMs:Number(elapsedMs.toFixed(3)),calls:1};
    const budget=evaluateBudget(this.budgets[capability]??{},usage);
    if(!budget.ok)throw new Error(`Capability budget exceeded for ${capability}: ${budget.violations.join('; ')}`);
    return{value,usage,providerId:selection.provider.id,degraded:selection.status==='degraded'};
  }
}

export function evaluateBudget(budget:OperationalBudget,usage:BudgetUsage):BudgetEvaluation{
  const violations:string[]=[];
  if(budget.maxLatencyMs!==undefined&&(usage.latencyMs??0)>budget.maxLatencyMs)violations.push(`latency ${usage.latencyMs}ms > ${budget.maxLatencyMs}ms`);
  if(budget.maxCalls!==undefined&&(usage.calls??0)>budget.maxCalls)violations.push(`calls ${usage.calls} > ${budget.maxCalls}`);
  if(budget.maxCostUsd!==undefined&&(usage.costUsd??0)>budget.maxCostUsd)violations.push(`cost ${usage.costUsd} > ${budget.maxCostUsd}`);
  if(budget.maxTokens!==undefined&&(usage.tokens??0)>budget.maxTokens)violations.push(`tokens ${usage.tokens} > ${budget.maxTokens}`);
  return{ok:violations.length===0,violations};
}

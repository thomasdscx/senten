import { readFile } from 'node:fs/promises';
import type { WorkflowDefinition, WorkflowFailurePolicy, WorkflowRunRecord, WorkflowStep, WorkflowStepResult } from '../../core/src/index.js';

export interface WorkflowExecutionContext {
  definition: WorkflowDefinition;
  inputs: Record<string,string>;
  dryRun: boolean;
  execute(command: string, args: string[]): Promise<void>;
  runNested?(name: string, inputs: Record<string,string>, dryRun: boolean): Promise<void>;
  rollback?(): Promise<void>;
}

export async function loadWorkflow(path:string):Promise<WorkflowDefinition>{
  const parsed=JSON.parse(await readFile(path,'utf8')) as WorkflowDefinition;
  validateWorkflow(parsed);
  return parsed;
}

export function validateWorkflow(value:WorkflowDefinition):void{
  if(value.senten!==1||value.kind!=='workflow')throw new Error('Invalid Senten workflow header.');
  if(!value.name||!value.version)throw new Error('Workflow requires name and version.');
  if(!Array.isArray(value.steps)||!value.steps.length)throw new Error('Workflow requires at least one step.');
  for(const [i,step] of value.steps.entries()){
    if(Boolean(step.command)===Boolean(step.workflow))throw new Error(`Workflow step ${i+1} must specify exactly one of command or workflow.`);
    if(step.onFailure&&!['stop','continue','rollback'].includes(step.onFailure))throw new Error(`Invalid onFailure for step ${i+1}.`);
  }
}

export function resolveWorkflowInputs(definition:WorkflowDefinition, provided:Record<string,string>):Record<string,string>{
  const out:Record<string,string>={};
  for(const [key,spec] of Object.entries(definition.inputs??{})){
    const value=provided[key]??spec.default;
    if(value===undefined&&spec.required)throw new Error(`Missing required workflow input: ${key}`);
    if(value!==undefined)out[key]=value;
  }
  for(const [key,value] of Object.entries(provided))out[key]=value;
  return out;
}

export function interpolate(value:string,inputs:Record<string,string>):string{
  return value.replace(/\$\{([a-zA-Z0-9_.-]+)\}/g,(_,key:string)=>inputs[key]??'');
}

export function shouldRun(condition:string|undefined,previous:'passed'|'failed'|'none',inputs:Record<string,string>):boolean{
  if(!condition||condition==='always')return true;
  if(condition==='previous.success')return previous==='passed';
  if(condition==='previous.failed')return previous==='failed';
  const match=condition.match(/^input\.([a-zA-Z0-9_.-]+)\s*(==|!=)\s*["']?([^"']+)["']?$/);
  if(match){const [,key,op,expected]=match;const actual=inputs[key!];return op==='=='?actual===expected:actual!==expected;}
  throw new Error(`Unsupported workflow condition: ${condition}`);
}

export async function executeWorkflow(ctx:WorkflowExecutionContext, seed:WorkflowRunRecord):Promise<WorkflowRunRecord>{
  let previous:'passed'|'failed'|'none'='none';
  const results:WorkflowStepResult[]=[];
  let failedError:string|undefined;
  for(let index=0;index<ctx.definition.steps.length;index++){
    const step=ctx.definition.steps[index]!;
    const id=step.id??`step_${index+1}`;
    const label=step.workflow?`workflow:${step.workflow}`:step.command!;
    const startedAt=new Date().toISOString();
    if(!shouldRun(step.if,previous,ctx.inputs)){
      results.push({id,index,command:label,status:'skipped',startedAt,endedAt:new Date().toISOString()});
      continue;
    }
    if(ctx.dryRun){results.push({id,index,command:label,status:'planned',startedAt,endedAt:new Date().toISOString()});previous='passed';continue;}
    try{
      if(step.workflow){if(!ctx.runNested)throw new Error('Nested workflow execution is unavailable.');await ctx.runNested(interpolate(step.workflow,ctx.inputs),ctx.inputs,false);}
      else await ctx.execute(interpolate(step.command!,ctx.inputs),(step.args??[]).map(a=>interpolate(a,ctx.inputs)));
      results.push({id,index,command:label,status:'passed',startedAt,endedAt:new Date().toISOString()});previous='passed';
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      results.push({id,index,command:label,status:'failed',startedAt,endedAt:new Date().toISOString(),error:message});previous='failed';failedError=message;
      const policy:WorkflowFailurePolicy=step.onFailure??ctx.definition.onFailure??'stop';
      if(policy==='continue')continue;
      if(policy==='rollback'&&ctx.rollback)await ctx.rollback();
      break;
    }
  }
  const failed=results.some(r=>r.status==='failed');
  return {...seed,steps:results,status:ctx.dryRun?'planned':failed?'failed':'passed',endedAt:new Date().toISOString(),...(failedError?{error:failedError}:{})};
}

export function workflowPlan(definition:WorkflowDefinition,inputs:Record<string,string>):string[]{
  let previous:'passed'|'failed'|'none'='none';
  return definition.steps.map((step,index)=>{
    const label=step.workflow?`workflow ${interpolate(step.workflow,inputs)}`:`senten ${interpolate(step.command!,inputs)} ${(step.args??[]).map(a=>interpolate(a,inputs)).join(' ')}`.trim();
    const active=shouldRun(step.if,previous,inputs); if(active)previous='passed';
    return `${index+1}. ${active?label:`[skip] ${label}`}`;
  });
}

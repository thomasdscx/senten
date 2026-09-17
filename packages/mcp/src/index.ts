import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';

export interface McpToolDefinition {
  name:string;
  description:string;
  command:string;
  capability:string;
  mutating:boolean;
  inputSchema:{type:'object';properties:{args:{type:'array';items:{type:'string'}}};additionalProperties:false};
}
export interface McpServerOptions {
  cwd:string;
  entrypoint:string;
  tools:McpToolDefinition[];
  allowWrite?:boolean;
  allowLiveEffects?:boolean;
  timeoutMs?:number;
  maxRequestBytes?:number;
  maxOutputBytes?:number;
}
interface RpcRequest {jsonrpc?:string;id?:string|number|null;method?:string;params?:unknown;}
interface ToolCallParams {name?:string;arguments?:{args?:unknown};}

const SENSITIVE_PATH_PARTS = new Set(['.env','.git','.npmrc','.pypirc','id_rsa','id_ed25519','credentials','secrets']);
const SENSITIVE_ASSIGNMENT = /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*)\s*[:=]\s*([^\s,;]+)/gi;
const SERVER_AUTHORITY_FLAGS = new Set(['--allow-write','--allow-live-effects','--allow-remote']);
function looksLikeUrl(value:string):boolean{return /^https?:\/\//i.test(value);}
function escapesProject(cwd:string,value:string):boolean{const resolved=resolve(cwd,value);const rel=relative(resolve(cwd),resolved);return rel.startsWith('..')||isAbsolute(rel);}
function semanticFilePath(value:string):string|undefined{return value.toLowerCase().startsWith('file:')?value.slice(5):undefined;}
function insideProject(cwd:string,path:string):boolean{const rel=relative(resolve(cwd),resolve(cwd,path));return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));}
export function validateMcpArguments(cwd:string,args:string[]):{ok:boolean;reason?:string}{
  for(let i=0;i<args.length;i++){
    const arg=args[i]!;const normalized=arg.replaceAll('\\','/').toLowerCase();
    if(SERVER_AUTHORITY_FLAGS.has(arg))return{ok:false,reason:`MCP clients cannot self-grant server authority with ${arg}.`};
    const parts=normalized.split(/[/:]/).filter(Boolean);
    if(parts.some(part=>SENSITIVE_PATH_PARTS.has(part)))return{ok:false,reason:`Sensitive project path is not exposed through MCP arguments: ${arg}`};
    if(isAbsolute(arg)&&!insideProject(cwd,arg))return{ok:false,reason:`Path escapes the MCP project scope: ${arg}`};
    const semanticPath=semanticFilePath(arg);if(semanticPath&&escapesProject(cwd,semanticPath))return{ok:false,reason:`Semantic file reference escapes the MCP project scope: ${arg}`};
    if(!looksLikeUrl(arg)&&(arg.startsWith('./')||arg.startsWith('../')||arg.includes('\\'))&&escapesProject(cwd,arg))return{ok:false,reason:`Relative path escapes the MCP project scope: ${arg}`};
    if((arg==='--output'||arg==='--root'||arg==='--cwd')&&args[i+1]){const value=args[i+1]!;if(escapesProject(cwd,value))return{ok:false,reason:`${arg} must remain inside the MCP project scope.`};}
  }
  return{ok:true};
}
export function redactMcpOutput(text:string):string{
  return text.replace(SENSITIVE_ASSIGNMENT,(_match,key:string)=>`${key}=<redacted>`).replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,'<redacted-private-key>');
}

export function buildMcpToolDefinitions(commands:Array<{name:string;description?:string;capability:string;mutating?:boolean}>):McpToolDefinition[]{
  return commands.map(command=>({name:`senten_${command.name.replaceAll(/[^a-zA-Z0-9]+/g,'_')}`,description:command.description??`Senten ${command.name} operation`,command:command.name,capability:command.capability,mutating:Boolean(command.mutating),inputSchema:{type:'object',properties:{args:{type:'array',items:{type:'string'}}},additionalProperties:false}}));
}

function response(id:RpcRequest['id'],result:unknown):string{return JSON.stringify({jsonrpc:'2.0',id: id ?? null,result});}
function rpcError(id:RpcRequest['id'],code:number,message:string,data?:unknown):string{return JSON.stringify({jsonrpc:'2.0',id:id??null,error:{code,message,...(data===undefined?{}:{data})}});}
function textResult(text:string,isError=false):unknown{return {content:[{type:'text',text}],isError};}

export async function runMcpStdioServer(options:McpServerOptions):Promise<void>{
  const available=options.tools.filter(tool=>options.allowWrite||!tool.mutating);
  const tools=new Map(available.map(tool=>[tool.name,tool] as const));
  const rl=createInterface({input:process.stdin,crlfDelay:Infinity,terminal:false});
  for await (const line of rl){
    if(!line.trim())continue;
    if(Buffer.byteLength(line,'utf8')>(options.maxRequestBytes??262_144)){process.stdout.write(rpcError(null,-32600,'Request exceeds MCP transport limit')+'\n');continue;}
    let req:RpcRequest;
    try{req=JSON.parse(line) as RpcRequest;}catch{process.stdout.write(rpcError(null,-32700,'Parse error')+'\n');continue;}
    if(req.jsonrpc!=='2.0'||typeof req.method!=='string'){process.stdout.write(rpcError(req.id,-32600,'Invalid Request')+'\n');continue;}
    if(req.method.startsWith('notifications/'))continue;
    if(req.method==='initialize'){
      const requested=((req.params??{}) as {protocolVersion?:string}).protocolVersion;const supported=new Set(['2025-06-18','2024-11-05']);const protocolVersion=requested&&supported.has(requested)?requested:'2025-06-18';
      process.stdout.write(response(req.id,{protocolVersion,capabilities:{tools:{listChanged:false}},serverInfo:{name:'senten',version:'1.0.0-rc.1'},instructions:'Senten exposes project-scoped architecture intelligence. Mutating tools are disabled unless the server is started with --allow-write.'})+'\n');continue;
    }
    if(req.method==='ping'){process.stdout.write(response(req.id,{})+'\n');continue;}
    if(req.method==='tools/list'){
      process.stdout.write(response(req.id,{tools:available.map(({command,capability,mutating,...tool})=>({...tool,annotations:{readOnlyHint:!mutating,destructiveHint:mutating},_meta:{capability,command}}))})+'\n');continue;
    }
    if(req.method==='tools/call'){
      const params=(req.params??{}) as ToolCallParams;const tool=typeof params.name==='string'?tools.get(params.name):undefined;
      if(!tool){process.stdout.write(response(req.id,textResult(`Tool unavailable or not permitted: ${String(params.name??'')}`,true))+'\n');continue;}
      const rawArgs=params.arguments?.args;if(rawArgs!==undefined&&(!Array.isArray(rawArgs)||rawArgs.some(x=>typeof x!=='string'))){process.stdout.write(response(req.id,textResult('arguments.args must be an array of strings.',true))+'\n');continue;}
      const args=(rawArgs??[]) as string[];if(args.includes('--allow-live-effects')&&!options.allowLiveEffects){process.stdout.write(response(req.id,textResult('Live external effects are disabled for this MCP server. Restart with --allow-live-effects only in an explicitly authorized environment.',true))+'\n');continue;}
      const scope=validateMcpArguments(options.cwd,args);if(!scope.ok){process.stdout.write(response(req.id,textResult(scope.reason??'MCP argument policy denied the request.',true))+'\n');continue;}
      try{const executed=await executeSenten(options.entrypoint,tool.command,args,options);const output=redactMcpOutput(executed.stdout+(executed.stderr?`\n[stderr]\n${executed.stderr}`:''));process.stdout.write(response(req.id,textResult(output,executed.code!==0))+'\n');}
      catch(error){process.stdout.write(response(req.id,textResult(error instanceof Error?error.message:String(error),true))+'\n');}
      continue;
    }
    process.stdout.write(rpcError(req.id,-32601,`Method not found: ${req.method}`)+'\n');
  }
}

const MCP_ENV_ALLOWLIST=new Set(['PATH','Path','PATHEXT','SystemRoot','SYSTEMROOT','ComSpec','COMSPEC','WINDIR','HOME','USERPROFILE','TMP','TEMP','TMPDIR','LANG','LC_ALL','TERM','NODE_OPTIONS','NODE_PATH']);
export function mcpEnvironment(source:NodeJS.ProcessEnv=process.env):NodeJS.ProcessEnv{
  const env:NodeJS.ProcessEnv={SENTEN_MCP:'1'};
  for(const key of MCP_ENV_ALLOWLIST)if(source[key]!==undefined)env[key]=source[key];
  return env;
}

async function executeSenten(entrypoint:string,command:string,args:string[],options:McpServerOptions):Promise<{code:number;stdout:string;stderr:string}>{
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[entrypoint,command,...args],{cwd:options.cwd,env:mcpEnvironment(),shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const max=options.maxOutputBytes??1_000_000;let stdout='',stderr='',bytes=0,settled=false;
    const append=(current:string,chunk:Buffer):string=>{bytes+=chunk.length;if(bytes>max){child.kill();throw new Error(`MCP tool output exceeded ${max} bytes.`);}return current+chunk.toString('utf8');};
    child.stdout?.on('data',(chunk:Buffer)=>{try{stdout=append(stdout,chunk);}catch(error){if(!settled){settled=true;reject(error);}}});
    child.stderr?.on('data',(chunk:Buffer)=>{try{stderr=append(stderr,chunk);}catch(error){if(!settled){settled=true;reject(error);}}});
    const timer=setTimeout(()=>{if(!settled){settled=true;child.kill();reject(new Error(`MCP tool timed out after ${options.timeoutMs??30000}ms.`));}},options.timeoutMs??30000);
    child.on('error',error=>{clearTimeout(timer);if(!settled){settled=true;reject(error);}});
    child.on('close',code=>{clearTimeout(timer);if(!settled){settled=true;resolve({code:code??1,stdout:stdout.trim(),stderr:stderr.trim()});}});
  });
}

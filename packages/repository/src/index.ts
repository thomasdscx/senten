import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export interface RepositoryRef {
  provider: 'github';
  owner: string;
  repo: string;
  ref?: string;
}
export interface RepositoryTreeEntry {
  path: string;
  type: 'blob'|'tree';
  sha: string;
  size?: number;
}
export interface RepositorySnapshot {
  repository: RepositoryRef;
  defaultBranch: string;
  commitSha: string;
  treeSha: string;
  private: boolean;
  permissions?: Record<string, boolean>;
  entries: RepositoryTreeEntry[];
}
export interface RepositoryReadOptions { maxBytes?: number; }

function api(path:string){return `https://api.github.com${path}`;}
function parseGithub(input:string):RepositoryRef{
  const cleaned=input.trim().replace(/^github:/,'').replace(/^https:\/\/github\.com\//,'').replace(/\.git\/?$/,'').replace(/^\/+|\/+$/g,'');
  const parts=cleaned.split('/');
  if(parts.length!==2||!parts[0]||!parts[1]||!parts.every(x=>/^[A-Za-z0-9_.-]+$/.test(x)))throw new Error('Expected GitHub repository as owner/name, github:owner/name, or https://github.com/owner/name.');
  return {provider:'github',owner:parts[0],repo:parts[1]};
}
function ghToken():string|undefined{
  for(const key of ['SENTEN_GITHUB_TOKEN','GITHUB_TOKEN','GH_TOKEN']){const v=process.env[key]?.trim();if(v)return v;}
  const r=spawnSync('gh',['auth','token'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],shell:false});
  return r.status===0&&r.stdout.trim()?r.stdout.trim():undefined;
}
function headers(token?:string):Record<string,string>{return {'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'senten/1.0',...(token?{'Authorization':`Bearer ${token}`}:{})};}
async function requestJson<T>(url:string,token?:string):Promise<T>{
  const r=await fetch(url,{headers:headers(token),redirect:'follow'});
  if(r.status===401||r.status===403)throw new Error(`GitHub access denied (${r.status}). Run 'gh auth login' or set SENTEN_GITHUB_TOKEN with read-only repository access.`);
  if(r.status===404)throw new Error('GitHub repository or ref not found, or the authenticated account cannot access it.');
  if(!r.ok)throw new Error(`GitHub request failed (${r.status}): ${(await r.text()).slice(0,300)}`);
  return await r.json() as T;
}
export function githubCredentialStatus():{source:'senten-env'|'github-env'|'gh-cli'|'none';available:boolean}{
  if(process.env.SENTEN_GITHUB_TOKEN?.trim())return{source:'senten-env',available:true};
  if(process.env.GITHUB_TOKEN?.trim()||process.env.GH_TOKEN?.trim())return{source:'github-env',available:true};
  const r=spawnSync('gh',['auth','status'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false});return r.status===0?{source:'gh-cli',available:true}:{source:'none',available:false};
}
export class GitHubRepositoryProvider {
  readonly token:string|undefined;
  constructor(token?:string){this.token=token??ghToken();}
  parse(input:string):RepositoryRef{return parseGithub(input);}
  async snapshot(input:string,ref?:string):Promise<RepositorySnapshot>{
    const repo=this.parse(input);const token=this.token;
    const meta=await requestJson<{default_branch:string;private:boolean;permissions?:Record<string,boolean>}>(api(`/repos/${repo.owner}/${repo.repo}`),token);
    const target=encodeURIComponent(ref??meta.default_branch);
    const commit=await requestJson<{sha:string;commit:{tree:{sha:string}}}>(api(`/repos/${repo.owner}/${repo.repo}/commits/${target}`),token);
    const tree=await requestJson<{sha:string;truncated:boolean;tree:Array<{path:string;type:'blob'|'tree';sha:string;size?:number}>}>(api(`/repos/${repo.owner}/${repo.repo}/git/trees/${commit.commit.tree.sha}?recursive=1`),token);
    if(tree.truncated)throw new Error('GitHub tree response was truncated. Use a narrower repository/ref or local analysis for this repository.');
    return{repository:{...repo,ref:ref??meta.default_branch},defaultBranch:meta.default_branch,commitSha:commit.sha,treeSha:tree.sha,private:meta.private,...(meta.permissions?{permissions:meta.permissions}:{}),entries:tree.tree.map(x=>({path:x.path,type:x.type,sha:x.sha,...(typeof x.size==='number'?{size:x.size}:{})}))};
  }
  async readText(input:string,path:string,ref?:string,options:RepositoryReadOptions={}):Promise<{content:string;sha:string;size:number}>{
    const repo=this.parse(input);const maxBytes=options.maxBytes??512_000;
    const q=ref?`?ref=${encodeURIComponent(ref)}`:'';
    const file=await requestJson<{type:string;encoding?:string;content?:string;sha:string;size:number}>(api(`/repos/${repo.owner}/${repo.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}${q}`),this.token);
    if(file.type!=='file')throw new Error(`Repository path is not a file: ${path}`);if(file.size>maxBytes)throw new Error(`Repository file exceeds read budget (${file.size} > ${maxBytes} bytes): ${path}`);
    if(file.encoding!=='base64'||typeof file.content!=='string')throw new Error(`Unsupported GitHub content encoding for ${path}`);
    const content=Buffer.from(file.content.replace(/\n/g,''),'base64').toString('utf8');return{content,sha:file.sha,size:file.size};
  }
}
export function repositoryFingerprint(snapshot:RepositorySnapshot):string{return createHash('sha256').update(`${snapshot.repository.owner}/${snapshot.repository.repo}\0${snapshot.commitSha}\0${snapshot.treeSha}`).digest('hex');}

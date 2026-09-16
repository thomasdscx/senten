import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { RegistryConfig, SentenPackageManifest } from '../../core/src/index.js';
export interface RegistryEntry { manifest:SentenPackageManifest; path:string; registry:string; remote?:boolean; manifestUrl?:string; baseUrl?:string; }
export interface HttpRegistryIndex { sentenRegistry:1; name?:string; generatedAt?:string; packages:Array<{manifest:SentenPackageManifest; baseUrl?:string; manifestUrl?:string}>; }
export class LocalRegistry {
  constructor(public readonly config:RegistryConfig) { if(config.type!=='local')throw new Error('LocalRegistry only supports local registry configs.'); }
  async ensure():Promise<void>{await mkdir(resolve(this.config.location),{recursive:true});}
  async list():Promise<RegistryEntry[]>{await this.ensure();const out:RegistryEntry[]=[];for(const entry of await readdir(resolve(this.config.location))){const root=join(resolve(this.config.location),entry);try{const manifest=JSON.parse(await readFile(join(root,'senten.package.json'),'utf8')) as SentenPackageManifest;out.push({manifest,path:root,registry:this.config.name});}catch{}}return out;}
  async find(name:string,kind?:string):Promise<RegistryEntry|undefined>{return (await this.list()).find(e=>e.manifest.name===name&&(!kind||e.manifest.kind===kind));}
  async publish(packageRoot:string):Promise<RegistryEntry>{await this.ensure();const source=resolve(packageRoot);const manifest=JSON.parse(await readFile(join(source,'senten.package.json'),'utf8')) as SentenPackageManifest;const dest=join(resolve(this.config.location),`${manifest.kind}-${manifest.name}-${manifest.version}`);await rm(dest,{recursive:true,force:true});await cp(source,dest,{recursive:true,errorOnExist:false});return{manifest,path:dest,registry:this.config.name};}
}
export class HttpRegistry {
  constructor(public readonly config:RegistryConfig){if(config.type!=='http')throw new Error('HttpRegistry only supports http registry configs.');}
  private indexUrl():string{return `${this.config.location.replace(/\/$/,'')}/index.json`;}
  async index():Promise<HttpRegistryIndex>{const res=await fetch(this.indexUrl(),{headers:{accept:'application/json'}});if(!res.ok)throw new Error(`Registry ${this.config.name} returned HTTP ${res.status}`);const data=await res.json() as HttpRegistryIndex;if(data.sentenRegistry!==1||!Array.isArray(data.packages))throw new Error(`Invalid Senten registry index: ${this.indexUrl()}`);return data;}
  async list():Promise<RegistryEntry[]>{const index=await this.index();return index.packages.map(p=>({manifest:p.manifest,path:p.baseUrl??p.manifestUrl??'',registry:this.config.name,remote:true,...(p.baseUrl?{baseUrl:p.baseUrl}:{}),...(p.manifestUrl?{manifestUrl:p.manifestUrl}:{})}));}
  async find(name:string,kind?:string):Promise<RegistryEntry|undefined>{return (await this.list()).find(e=>e.manifest.name===name&&(!kind||e.manifest.kind===kind));}
  async fetchPackage(entry:RegistryEntry,destination:string):Promise<string>{
    const root=resolve(destination);await rm(root,{recursive:true,force:true});await mkdir(join(root,'payload'),{recursive:true});
    const manifest=entry.manifest;const registryBase=this.config.location.replace(/\/$/,'');
    const base=(entry.baseUrl?new URL(entry.baseUrl,`${registryBase}/`).toString():`${registryBase}/packages/${encodeURIComponent(manifest.kind)}-${encodeURIComponent(manifest.name)}-${encodeURIComponent(manifest.version)}/`).replace(/\/$/,'');
    await writeFile(join(root,'senten.package.json'),JSON.stringify(manifest,null,2)+'\n');
    for(const file of manifest.files??[]){const url=`${base}/payload/${file.split('/').map(encodeURIComponent).join('/')}`;const res=await fetch(url);if(!res.ok)throw new Error(`Failed to download ${file}: HTTP ${res.status}`);const bytes=Buffer.from(await res.arrayBuffer());const dest=join(root,'payload',file);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes);}
    if(manifest.metadata?.semanticBlueprint===true){const res=await fetch(`${base}/senten.blueprint.json`);if(res.ok)await writeFile(join(root,'senten.blueprint.json'),Buffer.from(await res.arrayBuffer()));}
    return root;
  }
}
export function registryFor(config:RegistryConfig):LocalRegistry|HttpRegistry{return config.type==='http'?new HttpRegistry(config):new LocalRegistry(config);}

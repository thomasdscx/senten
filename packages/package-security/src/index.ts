import { createHash, generateKeyPairSync, sign, verify, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { SentenPackageManifest } from '../../core/src/index.js';

export interface PackageSignature { algorithm:'ed25519'; keyId:string; publisher?:string; publicKey:string; signature:string; signedDigest:string; createdAt:string; }
export interface TrustRecord { keyId:string; publicKey:string; publisher?:string; addedAt:string; source?:string; }
export interface TrustStore { version:1; keys:TrustRecord[]; }
export interface CompatibilityResult { ok:boolean; reasons:string[]; }

export function stableJson(value:unknown):string {
  if(Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if(value && typeof value==='object') return `{${Object.entries(value as Record<string,unknown>).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function manifestSigningPayload(manifest:SentenPackageManifest):Buffer {
  const clone={...manifest,signatures:undefined};
  const digest=manifest.integrity?.packageDigest??'';
  return Buffer.from(`${stableJson(clone)}\n${digest}`,'utf8');
}
export function keyIdFromPublicKey(publicKey:string):string { return `ed25519:${createHash('sha256').update(publicKey).digest('hex').slice(0,24)}`; }
export async function generateSigningKey(out:string,publisher?:string):Promise<{privateKeyPath:string;publicKeyPath:string;keyId:string}> {
  const {privateKey,publicKey}=generateKeyPairSync('ed25519',{privateKeyEncoding:{format:'pem',type:'pkcs8'},publicKeyEncoding:{format:'pem',type:'spki'}});
  const dir=resolve(out); await mkdir(dir,{recursive:true});
  const id=keyIdFromPublicKey(publicKey);
  const privateKeyPath=join(dir,`${publisher??'senten'}-${id.slice(-8)}.private.pem`);
  const publicKeyPath=join(dir,`${publisher??'senten'}-${id.slice(-8)}.public.pem`);
  await writeFile(privateKeyPath,privateKey,{mode:0o600}); await writeFile(publicKeyPath,publicKey);
  return {privateKeyPath,publicKeyPath,keyId:id};
}
export async function signPackageManifest(packageRoot:string,privateKeyPath:string,publisher?:string):Promise<SentenPackageManifest> {
  const manifestPath=join(resolve(packageRoot),'senten.package.json');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8')) as SentenPackageManifest;
  if(!manifest.integrity?.packageDigest) throw new Error('Package must have integrity metadata before signing.');
  const base:SentenPackageManifest={...manifest,...((publisher??manifest.publisher)?{publisher:publisher??manifest.publisher}:{})}; delete (base as any).signatures;
  const privateKey=await readFile(resolve(privateKeyPath),'utf8');
  const publicKey=createPublicKey(privateKey).export({format:'pem',type:'spki'}).toString();
  const keyId=keyIdFromPublicKey(publicKey);
  const signedDigest=createHash('sha256').update(manifestSigningPayload(base)).digest('hex');
  const signature=sign(null,manifestSigningPayload(base),privateKey).toString('base64');
  const record:PackageSignature={algorithm:'ed25519',keyId,publicKey,signature,signedDigest,createdAt:new Date().toISOString(),...(base.publisher?{publisher:base.publisher}:{})};
  const next={...base,signatures:[...(manifest.signatures??[]).filter(x=>x.keyId!==keyId),record]};
  await writeFile(manifestPath,JSON.stringify(next,null,2)+'\n'); return next;
}
export function verifyManifestSignatures(manifest:SentenPackageManifest,trust?:TrustStore):{valid:PackageSignature[];trusted:PackageSignature[];errors:string[]} {
  const valid:PackageSignature[]=[]; const trusted:PackageSignature[]=[]; const errors:string[]=[];
  for(const sig of manifest.signatures??[]){
    try {
      const keyId=keyIdFromPublicKey(sig.publicKey); if(keyId!==sig.keyId){errors.push(`signature key id mismatch: ${sig.keyId}`);continue;}
      const actualDigest=createHash('sha256').update(manifestSigningPayload(manifest)).digest('hex');
      if(sig.signedDigest!==actualDigest){errors.push(`signed digest mismatch: ${sig.keyId}`);continue;}
      if(!verify(null,manifestSigningPayload(manifest),sig.publicKey,Buffer.from(sig.signature,'base64'))){errors.push(`invalid signature: ${sig.keyId}`);continue;}
      valid.push(sig);
      if(trust?.keys.some(k=>k.keyId===sig.keyId && (!k.publisher || !sig.publisher || k.publisher===sig.publisher))) trusted.push(sig);
    } catch(e){errors.push(`signature verification error: ${sig.keyId}: ${e instanceof Error?e.message:String(e)}`);}
  }
  return {valid,trusted,errors};
}
export async function loadTrustStore(cwd:string):Promise<TrustStore>{ try{return JSON.parse(await readFile(join(cwd,'.senten','trust.json'),'utf8')) as TrustStore;}catch{return{version:1,keys:[]};} }
export async function saveTrustStore(cwd:string,store:TrustStore):Promise<void>{const path=join(cwd,'.senten','trust.json');await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(store,null,2)+'\n');}
export async function trustPublicKey(cwd:string,keyPath:string,publisher?:string):Promise<TrustRecord>{const publicKey=await readFile(resolve(keyPath),'utf8');const keyId=keyIdFromPublicKey(publicKey);const store=await loadTrustStore(cwd);const record:TrustRecord={keyId,publicKey,addedAt:new Date().toISOString(),source:basename(keyPath),...(publisher?{publisher}:{})};store.keys=store.keys.filter(k=>k.keyId!==keyId);store.keys.push(record);await saveTrustStore(cwd,store);return record;}

function parse(v:string):[number,number,number]{const m=v.replace(/^v/,'').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);return m?[Number(m[1]),Number(m[2]??0),Number(m[3]??0)]:[0,0,0];}
function cmp(a:[number,number,number],b:[number,number,number]):number{return a[0]-b[0]||a[1]-b[1]||a[2]-b[2];}
export function satisfiesVersion(version:string,range?:string):boolean { if(!range||range==='*')return true;const v=parse(version);for(const part of range.split(/\s+/).filter(Boolean)){if(part.startsWith('>=')){if(cmp(v,parse(part.slice(2)))<0)return false;}else if(part.startsWith('>')){if(cmp(v,parse(part.slice(1)))<=0)return false;}else if(part.startsWith('<=')){if(cmp(v,parse(part.slice(2)))>0)return false;}else if(part.startsWith('<')){if(cmp(v,parse(part.slice(1)))>=0)return false;}else if(part.startsWith('^')){const b=parse(part.slice(1));if(v[0]!==b[0]||cmp(v,b)<0)return false;}else if(part.startsWith('~')){const b=parse(part.slice(1));if(v[0]!==b[0]||v[1]!==b[1]||cmp(v,b)<0)return false;}else if(part!==version)return false;}return true; }
export function checkCompatibility(manifest:SentenPackageManifest,currentSenten:string,nodeVersion=process.versions.node):CompatibilityResult {const reasons:string[]=[];const sentenRange=manifest.compatibility?.senten??manifest.sentenVersion;if(sentenRange&&!satisfiesVersion(currentSenten,sentenRange))reasons.push(`requires Senten ${sentenRange}; current ${currentSenten}`);const nodeRange=manifest.compatibility?.node;if(nodeRange&&!satisfiesVersion(nodeVersion,nodeRange))reasons.push(`requires Node ${nodeRange}; current ${nodeVersion}`);return{ok:reasons.length===0,reasons};}

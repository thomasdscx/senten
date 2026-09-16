import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPackageFromDirectory, loadPackage, verifyPackage } from '../packages/templates/src/index.js';
import { checkCompatibility, generateSigningKey, loadTrustStore, signPackageManifest, trustPublicKey, verifyManifestSignatures } from '../packages/package-security/src/index.js';
import { HttpRegistry } from '../packages/registry/src/index.js';
import { defineSentenExtension, validateSentenExtension } from '../packages/extension-sdk/src/index.js';

test('packages can be signed with Ed25519 and verified against a trusted publisher key', async () => {
  const root=await mkdtemp(join(tmpdir(),'senten-sign-'));const project=join(root,'project');await mkdir(project);await writeFile(join(project,'hello.txt'),'hello');
  const built=await createPackageFromDirectory(project,join(root,'packages'),'signed-demo','template');
  const keys=await generateSigningKey(join(root,'keys'),'acme');await signPackageManifest(built.root,keys.privateKeyPath,'acme');
  await mkdir(join(root,'.senten'),{recursive:true});await trustPublicKey(root,keys.publicKeyPath,'acme');
  const manifest=await loadPackage(built.root);const trust=await loadTrustStore(root);const signatures=verifyManifestSignatures(manifest,trust);
  assert.equal(signatures.errors.length,0);assert.equal(signatures.valid.length,1);assert.equal(signatures.trusted.length,1);
  assert.equal((await verifyPackage(built.root)).ok,true);
});

test('compatibility contracts reject incompatible Senten versions', async () => {
  const root=await mkdtemp(join(tmpdir(),'senten-compat-'));await writeFile(join(root,'a.txt'),'a');const built=await createPackageFromDirectory(root,join(root,'.packages'),'compat','template');
  const manifest=await loadPackage(built.root);assert.equal(checkCompatibility(manifest,'0.8.0-alpha.0').ok,true);assert.equal(checkCompatibility({...manifest,compatibility:{senten:'>=1.0.0'}},'0.8.0-alpha.0').ok,false);
});

test('HTTP registry index can discover and materialize a package without executing code', async () => {
  const root=await mkdtemp(join(tmpdir(),'senten-http-reg-'));const project=join(root,'project');await mkdir(project);await writeFile(join(project,'hello.txt'),'hello remote');const built=await createPackageFromDirectory(project,join(root,'built'),'remote-demo','template');
  const manifest=await loadPackage(built.root);let origin='';
  const server=createServer(async (req,res)=>{const url=req.url??'/';if(url==='/index.json'){res.setHeader('content-type','application/json');res.end(JSON.stringify({sentenRegistry:1,packages:[{manifest,baseUrl:`${origin}/packages/template-remote-demo-0.1.0`}]}));return;}if(url==='/packages/template-remote-demo-0.1.0/payload/hello.txt'){res.end(await readFile(join(built.root,'payload','hello.txt')));return;}res.statusCode=404;res.end('not found');});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('missing test server address');origin=`http://127.0.0.1:${address.port}`;
  try{const registry=new HttpRegistry({name:'remote',type:'http',location:origin});const found=await registry.find('remote-demo','template');assert.equal(found?.remote,true);if(!found)throw new Error('package not found');const dest=join(root,'download');await registry.fetchPackage(found,dest);assert.equal((await verifyPackage(dest)).ok,true);assert.equal(await readFile(join(dest,'payload','hello.txt'),'utf8'),'hello remote');}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('extension SDK validates namespaces and duplicate command registrations', () => {
  const good=defineSentenExtension({name:'Demo',namespace:'demo',version:'1.0.0',kind:'adapter',senten:'>=0.8.0',capabilities:['source.read'],commands:[{path:'inspect',description:'Inspect',run(){}}]});
  assert.equal(validateSentenExtension(good).ok,true);
  const bad=validateSentenExtension({name:'Bad',namespace:'Bad Namespace',version:'1.0.0',kind:'adapter',senten:'>=0.8.0',capabilities:[],commands:[{path:'x',description:'x',run(){}},{path:'x',description:'x',run(){}}]});
  assert.equal(bad.ok,false);assert.ok(bad.errors.some(x=>x.includes('namespace')));assert.ok(bad.errors.some(x=>x.includes('duplicate command')));
});

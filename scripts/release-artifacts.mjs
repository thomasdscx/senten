import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join, basename } from 'node:path';

const cwd=process.cwd();
const pkg=JSON.parse(await readFile(join(cwd,'package.json'),'utf8'));
const out=resolve(cwd,'release');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

function run(command,args){
  const r=spawnSync(command,args,{cwd,encoding:'utf8',shell:process.platform==='win32'});
  if(r.status!==0) throw new Error(`${command} ${args.join(' ')} failed\n${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
}

// npm pack returns the generated tarball name on its last non-empty line.
const packed=run('npm',['pack','--ignore-scripts']);
const tarball=packed.split(/\r?\n/).filter(Boolean).at(-1);
if(!tarball) throw new Error('npm pack did not return a tarball name.');
const source=join(cwd,tarball);
const destination=join(out,basename(tarball));
await copyFile(source,destination);
await rm(source,{force:true});
const bytes=await readFile(destination);
const sha256=createHash('sha256').update(bytes).digest('hex');
const manifest={
  schemaVersion:1,
  name:pkg.name,
  version:pkg.version,
  channel:pkg.version.includes('-alpha.')?'alpha':pkg.version.includes('-beta.')?'beta':pkg.version.includes('-rc.')?'rc':'stable',
  generatedAt:new Date().toISOString(),
  node:process.version,
  artifacts:[{file:basename(destination),type:'npm-tarball',sha256,size:bytes.length}],
};
await writeFile(join(out,'SHA256SUMS'),`${sha256}  ${basename(destination)}\n`);
await writeFile(join(out,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`RELEASE ARTIFACTS ${pkg.version}`);
console.log(`Tarball   ${basename(destination)}`);
console.log(`SHA-256   ${sha256}`);
console.log(`Manifest  release/release-manifest.json`);

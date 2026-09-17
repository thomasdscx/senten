import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(p:string)=>readFile(p,'utf8');

test('root package is publishable and keeps source-intelligence runtime dependency', async()=>{
  const pkg=JSON.parse(await read('package.json')) as {private?:boolean;version:string;files?:string[];dependencies?:Record<string,string>;publishConfig?:{tag?:string}};
  assert.notEqual(pkg.private,true);
  assert.equal(pkg.version,'1.0.0-rc.3');
  assert.ok(pkg.files?.includes('dist/packages/'));
  assert.ok(pkg.files?.includes('dist/adapters/'));
  assert.ok(pkg.files?.includes('dist/integrations/'));
  assert.ok(!pkg.files?.includes('dist/')); // keep tests and unrelated build output out of npm
  assert.equal(pkg.dependencies?.typescript,'5.8.3');
  assert.equal(pkg.publishConfig?.tag,'rc');
});

test('cross-platform CI names all three desktop operating systems', async()=>{
  const ci=await read('.github/workflows/ci.yml');
  assert.match(ci,/ubuntu-latest/);
  assert.match(ci,/windows-latest/);
  assert.match(ci,/macos-latest/);
});

test('Docker distribution runs as an unprivileged user', async()=>{
  const dockerfile=await read('Dockerfile');
  assert.match(dockerfile,/FROM node:22-bookworm-slim/);
  assert.match(dockerfile,/USER node/);
  assert.match(dockerfile,/ENTRYPOINT \["node", "\/opt\/senten\/bin\/senten\.mjs"\]/);
});


test('Node 22 is canonical while Bun compatibility remains experimental', async()=>{
  const runtime=await read('docs/RUNTIME_SUPPORT.md');
  assert.match(runtime,/Node\.js 22\.5 or newer/i);
  assert.match(runtime,/experimental runtime compatibility target/i);
  const bun=await read('.github/workflows/bun-experimental.yml');
  assert.match(bun,/oven-sh\/setup-bun@v2/);
  assert.match(bun,/continue-on-error: true/);
});

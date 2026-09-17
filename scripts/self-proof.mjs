import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const node=process.execPath;const cli=resolve('bin/senten.mjs');
const bindings=[
  ['invariant:mcp.live-effects-require-explicit-gate','dist/tests/build21-hardening.test.js'],
  ['invariant:mcp.paths-remain-project-scoped','dist/tests/builds-22-25-hardening.test.js'],
  ['invariant:sandbox.network-denied-by-default','dist/tests/build21-hardening.test.js'],
  ['invariant:evidence.verified-cannot-be-self-issued','dist/tests/assurance-launchproof.test.js'],
  ['invariant:adapter.merge-is-deterministic','dist/tests/build21-hardening.test.js'],
  ['invariant:secrets.never-enter-template','dist/tests/state-and-reuse.test.js'],
  ['invariant:agent.authority-is-bounded','dist/tests/agent-intelligence.test.js'],
  ['invariant:registry.remote-install-fails-closed','dist/tests/extension-ecosystem.test.js']
];
for(const [subject,file] of bindings){const r=spawnSync(node,[cli,'evidence','test',subject,'--allow-exec','--',node,'--test','--test-concurrency=1',file],{cwd:process.cwd(),stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);}

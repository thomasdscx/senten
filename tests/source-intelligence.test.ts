import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSourceProject, diffIR } from '../packages/source-intelligence/src/index.js';

test('source intelligence discovers files, imports, React components, routes and actions', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'senten-source-'));
  await mkdir(join(cwd, 'app', 'api', 'projects'), { recursive: true });
  await mkdir(join(cwd, 'components'), { recursive: true });
  await writeFile(join(cwd, 'components', 'ProjectCard.tsx'), `import React from 'react';\nexport function ProjectCard(){ return <div>Project</div>; }\n`);
  await writeFile(join(cwd, 'app', 'api', 'projects', 'route.ts'), `import { ProjectCard } from '../../../components/ProjectCard';\nexport async function POST(){ return Response.json({ ok: true }); }\n`);
  const result = await discoverSourceProject(cwd, { id: 'demo', name: 'Demo' });
  assert.equal(result.stats.files, 2);
  assert.ok(result.ir.nodes.some(n => n.kind === 'component' && n.label === 'ProjectCard'));
  assert.ok(result.ir.nodes.some(n => n.kind === 'route' && n.label === '/api/projects'));
  assert.ok(result.ir.nodes.some(n => n.kind === 'action' && n.label === 'POST'));
  assert.ok(result.ir.edges.some(e => e.relation === 'imports'));
  const importEdge = result.ir.edges.find(e => e.relation === 'imports');
  assert.equal(importEdge?.from, 'file:app/api/projects/route.ts');
  assert.equal(importEdge?.to, 'file:components/ProjectCard.tsx');
  assert.ok(result.frameworks.includes('react'));
});

test('source intelligence uses content-addressed cache on unchanged files', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'senten-cache-'));
  await writeFile(join(cwd, 'index.ts'), `export function createProject() { return true; }\n`);
  const first = await discoverSourceProject(cwd, { id: 'demo', name: 'Demo' });
  const second = await discoverSourceProject(cwd, { id: 'demo', name: 'Demo' }, first.ir);
  assert.equal(first.stats.cacheMisses, 1);
  assert.equal(second.stats.cacheHits, 1);
  assert.equal(second.stats.cacheMisses, 0);
});

test('semantic diff classifies removed routes/actions as breaking', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'senten-diff-'));
  await mkdir(join(cwd, 'app', 'api', 'ping'), { recursive: true });
  const route = join(cwd, 'app', 'api', 'ping', 'route.ts');
  await writeFile(route, `export async function GET(){ return Response.json({ ok: true }); }\n`);
  const before = await discoverSourceProject(cwd, { id: 'demo', name: 'Demo' });
  await writeFile(route, `export const value = 1;\n`);
  const after = await discoverSourceProject(cwd, { id: 'demo', name: 'Demo' }, before.ir, { force: true });
  const diff = diffIR(before.ir, after.ir);
  assert.ok(diff.removedNodes.some(n => n.kind === 'action' && n.label === 'GET'));
  assert.ok(diff.breaking.some(x => x.includes('Removed action GET')));
});

import { ExtensionRegistry } from '../packages/extension-sdk/src/index.js';
import { reactAdapter } from '../adapters/react/src/index.js';

test('framework adapters can teach source intelligence through analyzers', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'senten-adapter-source-'));
  await writeFile(join(cwd, 'Counter.tsx'), `'use client';\nimport React, { useState } from 'react';\nexport function Counter(){ const [n] = useState(0); return <button>{n}</button>; }\n`);
  const registry = new ExtensionRegistry().register(reactAdapter);
  const result = await discoverSourceProject(cwd, { id: 'demo', name: 'Demo' }, undefined, { analyzers: registry.sourceAnalyzers() });
  assert.ok(result.ir.nodes.some(n => n.id.includes('state:react/useState@Counter.tsx')));
  assert.ok(result.ir.edges.some(e => e.relation === 'uses-hook'));
});

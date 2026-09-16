import test from 'node:test';
import assert from 'node:assert/strict';
import { parseElementRef } from '../packages/core/src/index.js';
import { StateTrussGraph } from '../packages/semantic/src/index.js';
import { defineContract } from '../packages/contracts/src/index.js';
import { defineAction, defineInvariant, ExecutionEngine } from '../packages/runtime/src/index.js';
import { definePolicy, PolicyEngine } from '../packages/security/src/index.js';
import { ExtensionRegistry } from '../packages/extension-sdk/src/index.js';
import { reactAdapter } from '../adapters/react/src/index.js';

test('Universal Element references are deterministic', () => {
  assert.deepEqual(parseElementRef('file:src/app.ts'), { kind: 'file', id: 'src/app.ts', raw: 'file:src/app.ts' });
  assert.deepEqual(parseElementRef('logo.png'), { kind: 'unknown', id: 'logo.png', raw: 'logo.png' });
});

test('StateTruss computes semantic impact', () => {
  const graph = new StateTrussGraph({ id: 'demo', name: 'Demo' });
  graph.addNode({ id: 'resource:Project', kind: 'resource' });
  graph.addNode({ id: 'action:project.create', kind: 'action' });
  graph.addNode({ id: 'policy:project.create', kind: 'policy' });
  graph.addEdge({ from: 'action:project.create', to: 'resource:Project', relation: 'writes' });
  graph.addEdge({ from: 'action:project.create', to: 'policy:project.create', relation: 'requires' });
  assert.equal(graph.impact('resource:Project').length, 2);
});

test('ExecutionEngine enforces policy and invariants', async () => {
  const policies = new PolicyEngine().register(definePolicy('project.create', () => ({ policyId: 'project.create', effect: 'allow' })));
  const engine = new ExecutionEngine(policies);
  const action = defineAction({
    id: 'project.create',
    input: defineContract('ProjectInput', (raw) => {
      if (!raw || typeof raw !== 'object' || typeof (raw as { name?: unknown }).name !== 'string') throw new Error('name required');
      return raw as { name: string };
    }),
    policy: 'project.create',
    audit: true,
    invariants: [defineInvariant('project.name', (value: { name: string }) => value.name.length > 0)],
    handler: async (input) => input
  });
  const result = await engine.execute(action, { name: 'Senten' }, { environment: 'test' });
  assert.equal(result.value.name, 'Senten');
  assert.ok(result.evidence.some((item) => item.status === 'tested' || item.status === 'observed'));
});

test('extension registry prevents namespace collisions', () => {
  const registry = new ExtensionRegistry().register(reactAdapter);
  assert.equal(registry.get('react')?.kind, 'adapter');
  assert.throws(() => registry.register(reactAdapter));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStateStore } from '../packages/local-state/src/index.js';
import { MemoryService } from '../packages/memory/src/index.js';
import { createPackageFromDirectory, verifyPackage } from '../packages/templates/src/index.js';
import { LocalRegistry } from '../packages/registry/src/index.js';
import type { OperationRecord } from '../packages/core/src/index.js';

test('operation ledger is append-only and derives applied/undone state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'senten-state-'));
  await mkdir(join(root, '.senten'), { recursive: true });
  const store = await LocalStateStore.open(root);
  const op: OperationRecord = {
    id: 'op_test', timestamp: new Date().toISOString(), actor: { type: 'human', id: 'test' },
    intent: 'create file', action: 'create', targets: ['a.txt'], environment: 'test', dryRun: false,
    status: 'applied', reversibility: 'reversible', rollback: { type: 'delete-created', path: 'a.txt' }
  };
  store.putOperation(op);
  store.appendEvent({ id: 'evt_a', type: 'operation.applied', timestamp: new Date().toISOString(), actor: op.actor, operationId: op.id });
  assert.equal(store.currentOperationState(op.id), 'applied');
  store.appendEvent({ id: 'evt_b', type: 'operation.undone', timestamp: new Date().toISOString(), actor: op.actor, operationId: op.id, inverseOf: op.id });
  assert.equal(store.currentOperationState(op.id), 'undone');
  store.appendEvent({ id: 'evt_c', type: 'operation.redone', timestamp: new Date().toISOString(), actor: op.actor, operationId: op.id, replays: op.id });
  assert.equal(store.currentOperationState(op.id), 'applied');
  assert.equal(store.listEvents(op.id).length, 3);
  store.close();
});

test('scoped memory resolves project decisions deterministically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'senten-memory-'));
  const store = await LocalStateStore.open(root);
  const memory = new MemoryService(store);
  memory.add({ kind: 'decision', scope: 'project', scopeId: 'demo', subject: 'database', value: 'Use PostgreSQL', actor: { type: 'human', id: 'test' } });
  const result = memory.resolve([{ scope: 'global' }, { scope: 'project', scopeId: 'demo' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.value, 'Use PostgreSQL');
  store.close();
});

test('template extraction excludes secrets and records integrity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'senten-template-'));
  await writeFile(join(root, 'README.md'), '# Demo\n');
  await writeFile(join(root, '.env'), 'SECRET=x\n');
  const out = join(root, '.packages');
  const result = await createPackageFromDirectory(root, out, 'demo', 'template');
  assert.ok(result.files.includes('README.md'));
  assert.ok(result.excluded.some((x) => x.endsWith('.env')));
  const verified = await verifyPackage(result.root);
  assert.equal(verified.ok, true);
  assert.ok(verified.manifest.integrity?.packageDigest);
});

test('local registry publishes a verified package copy', async () => {
  const root = await mkdtemp(join(tmpdir(), 'senten-registry-'));
  const source = join(root, 'source'); await mkdir(source);
  await writeFile(join(source, 'hello.txt'), 'hello');
  const built = await createPackageFromDirectory(source, join(root, 'built'), 'hello', 'template');
  const registry = new LocalRegistry({ name: 'local', type: 'local', location: join(root, 'registry'), trusted: true });
  const published = await registry.publish(built.root);
  const found = await registry.find('hello', 'template');
  assert.equal(found?.manifest.name, 'hello');
  assert.equal(await readFile(join(published.path, 'payload', 'hello.txt'), 'utf8'), 'hello');
});

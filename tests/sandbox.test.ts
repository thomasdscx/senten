import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalSandboxProvider, createSnapshot, restoreSnapshot, workspaceDigest } from '../packages/sandbox/src/index.js';

test('local sandbox copies project while excluding secrets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'senten-test-'));
  try {
    await writeFile(join(root, 'app.txt'), 'hello');
    await writeFile(join(root, '.env'), 'SECRET=real');
    await mkdir(join(root, '.senten'), { recursive: true });
    await writeFile(join(root, '.senten', 'senten.db'), 'private');
    const provider = new LocalSandboxProvider();
    const handle = await provider.create({ projectRoot: root, syntheticSecrets: ['API_TOKEN'] });
    assert.equal(await readFile(join(handle.record.root, 'app.txt'), 'utf8'), 'hello');
    await assert.rejects(() => readFile(join(handle.record.root, '.env'), 'utf8'));
    await assert.rejects(() => readFile(join(handle.record.root, '.senten', 'senten.db'), 'utf8'));
    const result = await handle.run({ command: process.execPath, args: ['-e', 'process.stdout.write(String(!!process.env.API_TOKEN))'] });
    assert.equal(result.code, 0);
    assert.equal(result.stdout, 'true');
    await handle.destroy();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('local sandbox refuses false network-deny guarantees', async () => {
  const root = await mkdtemp(join(tmpdir(), 'senten-test-'));
  try {
    const provider = new LocalSandboxProvider();
    await assert.rejects(() => provider.create({ projectRoot: root, network: 'deny' }), /cannot enforce network denial/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('sandbox snapshots restore deterministic workspace state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'senten-test-'));
  const snapshots = await mkdtemp(join(tmpdir(), 'senten-snap-'));
  try {
    await writeFile(join(root, 'app.txt'), 'v1');
    const provider = new LocalSandboxProvider();
    const handle = await provider.create({ projectRoot: root });
    const snap = await createSnapshot(handle.record, snapshots, 'baseline');
    const before = await workspaceDigest(handle.record.root);
    await writeFile(join(handle.record.root, 'app.txt'), 'v2');
    assert.notEqual(await workspaceDigest(handle.record.root), before);
    await restoreSnapshot(snap, handle.record.root);
    assert.equal(await workspaceDigest(handle.record.root), before);
    assert.equal(await readFile(join(handle.record.root, 'app.txt'), 'utf8'), 'v1');
    await handle.destroy();
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(snapshots, { recursive: true, force: true });
  }
});

test('sandbox execution enforces time and output budgets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'senten-test-'));
  try {
    const provider = new LocalSandboxProvider();
    const handle = await provider.create({ projectRoot: root, budget: { maxOutputBytes: 32, timeoutMs: 5000 } });
    const output = await handle.run({ command: process.execPath, args: ['-e', 'process.stdout.write("x".repeat(100))'] });
    assert.equal(output.truncated, true);
    assert.ok(Buffer.byteLength(output.stdout) <= 32);
    await handle.destroy();
  } finally { await rm(root, { recursive: true, force: true }); }
});

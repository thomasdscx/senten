import test from 'node:test';
import assert from 'node:assert/strict';
import { executeWorkflow, resolveWorkflowInputs, validateWorkflow, workflowPlan } from '../packages/workflows/src/index.js';
import type { WorkflowDefinition, WorkflowRunRecord } from '../packages/core/src/index.js';

const definition: WorkflowDefinition = {
  senten: 1,
  kind: 'workflow',
  name: 'release-check',
  version: '0.1.0',
  inputs: { environment: { required: true } },
  onFailure: 'stop',
  steps: [
    { id: 'doctor', command: 'doctor' },
    { id: 'proof', command: 'proof', args: ['--env', '${environment}'] },
  ],
};

test('workflow definitions validate and interpolate deterministic inputs', () => {
  validateWorkflow(definition);
  const inputs = resolveWorkflowInputs(definition, { environment: 'staging' });
  assert.deepEqual(inputs, { environment: 'staging' });
  assert.deepEqual(workflowPlan(definition, inputs), ['1. senten doctor', '2. senten proof --env staging']);
});

test('workflow runner executes sequential registered-command callbacks', async () => {
  const calls: string[] = [];
  const seed: WorkflowRunRecord = {
    id: 'wf_test', workflow: definition.name, version: definition.version,
    actor: { type: 'human', id: 'test' }, startedAt: new Date().toISOString(), status: 'running',
    inputs: { environment: 'staging' }, dryRun: false, operationEventCursor: 0, operationIds: [], steps: [],
  };
  const result = await executeWorkflow({
    definition,
    inputs: seed.inputs,
    dryRun: false,
    execute: async (command, args) => { calls.push([command, ...args].join(' ')); },
  }, seed);
  assert.equal(result.status, 'passed');
  assert.deepEqual(calls, ['doctor', 'proof --env staging']);
  assert.equal(result.steps.length, 2);
});

test('workflow rollback policy calls rollback and stops after a failure', async () => {
  const failing: WorkflowDefinition = {
    senten: 1, kind: 'workflow', name: 'safe-change', version: '0.1.0', onFailure: 'rollback',
    steps: [{ command: 'create', args: ['file', 'x.txt'] }, { command: 'proof' }, { command: 'report' }],
  };
  let rollbackCount = 0;
  const seed: WorkflowRunRecord = {
    id: 'wf_fail', workflow: failing.name, version: failing.version,
    actor: { type: 'agent', id: 'test' }, startedAt: new Date().toISOString(), status: 'running',
    inputs: {}, dryRun: false, operationEventCursor: 0, operationIds: [], steps: [],
  };
  const result = await executeWorkflow({
    definition: failing, inputs: {}, dryRun: false,
    execute: async (command) => { if (command === 'proof') throw new Error('proof failed'); },
    rollback: async () => { rollbackCount += 1; },
  }, seed);
  assert.equal(result.status, 'failed');
  assert.equal(rollbackCount, 1);
  assert.equal(result.steps.length, 2);
});

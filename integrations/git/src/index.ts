import { spawnSync } from 'node:child_process';
import { defineSentenExtension } from '../../../packages/extension-sdk/src/index.js';

export const gitIntegration = defineSentenExtension({
  name: 'Senten Git Integration',
  namespace: 'git',
  version: '0.1.5',
  kind: 'integration',
  senten: '>=0.1.5',
  capabilities: ['process.git', 'source.read'],
  commands: [
    {
      path: 'status',
      description: 'Show Git status through Senten.',
      run({ cwd }) {
        const result = spawnSync('git', ['status', '--short', '--branch'], { cwd, encoding: 'utf8' });
        process.stdout.write(result.stdout || result.stderr);
        return result.status ?? 1;
      }
    }
  ]
});

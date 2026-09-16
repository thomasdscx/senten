import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { SandboxRecord, SandboxRunRecord, SandboxSnapshotRecord } from '../../core/src/index.js';

export type SandboxProviderKind = 'local' | 'docker';
export type SandboxNetworkPolicy = 'inherit' | 'deny';
export type SandboxIsolation = 'workspace-copy' | 'container';

export interface SandboxResourceBudget {
  timeoutMs?: number | undefined;
  maxOutputBytes?: number | undefined;
  memoryMb?: number | undefined;
  cpus?: number | undefined;
  pids?: number | undefined;
}

export interface SandboxSpec {
  id?: string | undefined;
  projectRoot: string;
  root?: string | undefined;
  provider?: SandboxProviderKind | undefined;
  network?: SandboxNetworkPolicy | undefined;
  environmentName?: string | undefined;
  ttlMs?: number | undefined;
  copyProject?: boolean | undefined;
  syntheticSecrets?: string[] | undefined;
  budget?: SandboxResourceBudget | undefined;
  dockerImage?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface SandboxRunSpec {
  command: string;
  args?: string[] | undefined;
  env?: Record<string, string> | undefined;
  cwd?: string | undefined;
  timeoutMs?: number | undefined;
  maxOutputBytes?: number | undefined;
}

export interface SandboxRunResult {
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  truncated: boolean;
}

export interface SandboxHandle {
  record: SandboxRecord;
  run(spec: SandboxRunSpec): Promise<SandboxRunResult>;
  destroy(): Promise<void>;
}

export interface SandboxProvider {
  readonly kind: SandboxProviderKind;
  available(): Promise<boolean>;
  create(spec: SandboxSpec): Promise<SandboxHandle>;
  open(record: SandboxRecord): Promise<SandboxHandle>;
}

const PROJECT_EXCLUDES = new Set([
  '.git', '.senten', 'node_modules', 'dist', 'build', '.next', '.turbo', 'coverage',
  '.env', '.env.local', '.env.production', '.env.development', '.env.test'
]);
const SAFE_ENV_KEYS = new Set([
  'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'COMSPEC',
  'WINDIR', 'HOME', 'USERPROFILE', 'TMP', 'TEMP', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM',
  'NODE_OPTIONS', 'NODE_PATH'
]);

export class LocalSandboxProvider implements SandboxProvider {
  readonly kind = 'local' as const;
  async available(): Promise<boolean> { return true; }

  async create(spec: SandboxSpec): Promise<SandboxHandle> {
    if (spec.network === 'deny') {
      throw new Error('The local provider cannot enforce network denial. Use --provider docker for network=deny.');
    }
    const id = spec.id ?? `sbx_${randomUUID().slice(0, 8)}`;
    const root = spec.root ?? join(spec.projectRoot, '.senten', 'sandboxes', id, 'workspace');
    await mkdir(root, { recursive: true });
    if (spec.copyProject !== false) await copyProjectSanitized(spec.projectRoot, root);
    const synthetic = await writeSyntheticSecrets(root, spec.syntheticSecrets ?? []);
    const now = new Date();
    const record: SandboxRecord = {
      id,
      provider: 'local',
      isolation: 'workspace-copy',
      root,
      projectRoot: spec.projectRoot,
      environmentName: spec.environmentName ?? 'sandbox',
      network: 'inherit',
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: spec.ttlMs ? new Date(now.getTime() + spec.ttlMs).toISOString() : undefined,
      syntheticSecretNames: Object.keys(synthetic),
      budget: spec.budget,
      metadata: spec.metadata
    };
    return this.handle(record);
  }

  async open(record: SandboxRecord): Promise<SandboxHandle> {
    if (record.provider !== 'local') throw new Error(`Cannot open ${record.provider} sandbox with local provider.`);
    return this.handle(record);
  }

  private handle(record: SandboxRecord): SandboxHandle {
    return {
      record,
      run: async (spec) => {
        const secrets = await readSyntheticSecrets(record.root);
        return runProcess(spec.command, spec.args ?? [], resolveSandboxCwd(record.root, spec.cwd), {
          ...sanitizedEnvironment(),
          SENTEN_SANDBOX: '1',
          SENTEN_SANDBOX_ID: record.id,
          SENTEN_ENVIRONMENT: record.environmentName,
          ...secrets,
          ...(spec.env ?? {})
        }, {
          timeoutMs: spec.timeoutMs ?? record.budget?.timeoutMs,
          maxOutputBytes: spec.maxOutputBytes ?? record.budget?.maxOutputBytes
        });
      },
      destroy: () => rm(dirname(record.root), { recursive: true, force: true })
    };
  }
}

export class DockerSandboxProvider implements SandboxProvider {
  readonly kind = 'docker' as const;
  async available(): Promise<boolean> {
    const r = await runProcess('docker', ['version', '--format', '{{.Server.Version}}'], process.cwd(), sanitizedEnvironment(), { timeoutMs: 5000, maxOutputBytes: 4096 }, true).catch(() => undefined);
    return !!r && r.code === 0;
  }

  async create(spec: SandboxSpec): Promise<SandboxHandle> {
    if (!await this.available()) throw new Error('Docker provider requested, but Docker is unavailable or its daemon is not running.');
    const id = spec.id ?? `sbx_${randomUUID().slice(0, 8)}`;
    const root = spec.root ?? join(spec.projectRoot, '.senten', 'sandboxes', id, 'workspace');
    await mkdir(root, { recursive: true });
    if (spec.copyProject !== false) await copyProjectSanitized(spec.projectRoot, root);
    const synthetic = await writeSyntheticSecrets(root, spec.syntheticSecrets ?? []);
    const containerName = `senten-${id.replace(/[^a-zA-Z0-9_.-]/g, '-')}`;
    const image = spec.dockerImage ?? 'node:22-bookworm-slim';
    const args = ['create', '--name', containerName, '--workdir', '/workspace', '--volume', `${resolve(root)}:/workspace`];
    if ((spec.network ?? 'deny') === 'deny') args.push('--network', 'none');
    const budget = spec.budget ?? {};
    if (budget.memoryMb) args.push('--memory', `${budget.memoryMb}m`);
    if (budget.cpus) args.push('--cpus', String(budget.cpus));
    if (budget.pids) args.push('--pids-limit', String(budget.pids));
    for (const [key, value] of Object.entries(synthetic)) args.push('--env', `${key}=${value}`);
    args.push('--env', 'SENTEN_SANDBOX=1', '--env', `SENTEN_SANDBOX_ID=${id}`, '--env', `SENTEN_ENVIRONMENT=${spec.environmentName ?? 'sandbox'}`);
    args.push(image, 'sleep', 'infinity');
    const created = await runProcess('docker', args, spec.projectRoot, sanitizedEnvironment(), { timeoutMs: 30000, maxOutputBytes: 64_000 });
    if (created.code !== 0) throw new Error(`Docker sandbox creation failed: ${created.stderr || created.stdout}`);
    const started = await runProcess('docker', ['start', containerName], spec.projectRoot, sanitizedEnvironment(), { timeoutMs: 15000, maxOutputBytes: 16_000 });
    if (started.code !== 0) {
      await runProcess('docker', ['rm', '-f', containerName], spec.projectRoot, sanitizedEnvironment(), {}, true).catch(() => undefined);
      throw new Error(`Docker sandbox start failed: ${started.stderr || started.stdout}`);
    }
    const now = new Date();
    const record: SandboxRecord = {
      id,
      provider: 'docker',
      isolation: 'container',
      root,
      projectRoot: spec.projectRoot,
      environmentName: spec.environmentName ?? 'sandbox',
      network: spec.network ?? 'deny',
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: spec.ttlMs ? new Date(now.getTime() + spec.ttlMs).toISOString() : undefined,
      containerId: containerName,
      dockerImage: image,
      syntheticSecretNames: Object.keys(synthetic),
      budget: spec.budget,
      metadata: spec.metadata
    };
    return this.handle(record);
  }

  async open(record: SandboxRecord): Promise<SandboxHandle> {
    if (record.provider !== 'docker') throw new Error(`Cannot open ${record.provider} sandbox with Docker provider.`);
    if (!record.containerId) throw new Error(`Docker sandbox ${record.id} has no container id.`);
    return this.handle(record);
  }

  private handle(record: SandboxRecord): SandboxHandle {
    return {
      record,
      run: async (spec) => {
        if (!record.containerId) throw new Error('Missing Docker container id.');
        const cwd = spec.cwd ? `/workspace/${normalizeRelative(spec.cwd)}` : '/workspace';
        const args = ['exec', '--workdir', cwd];
        for (const [key, value] of Object.entries(spec.env ?? {})) args.push('--env', `${key}=${value}`);
        args.push(record.containerId, spec.command, ...(spec.args ?? []));
        return runProcess('docker', args, record.projectRoot, sanitizedEnvironment(), {
          timeoutMs: spec.timeoutMs ?? record.budget?.timeoutMs,
          maxOutputBytes: spec.maxOutputBytes ?? record.budget?.maxOutputBytes
        });
      },
      destroy: async () => {
        if (record.containerId) await runProcess('docker', ['rm', '-f', record.containerId], record.projectRoot, sanitizedEnvironment(), { timeoutMs: 15000 }, true).catch(() => undefined);
        await rm(dirname(record.root), { recursive: true, force: true });
      }
    };
  }
}

export async function copyProjectSanitized(projectRoot: string, targetRoot: string): Promise<void> {
  await mkdir(targetRoot, { recursive: true });
  const entries = await readdir(projectRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldExclude(entry.name)) continue;
    const source = join(projectRoot, entry.name);
    const target = join(targetRoot, entry.name);
    if (entry.isDirectory()) await cp(source, target, { recursive: true, filter: (src) => !shouldExclude(basename(src)) });
    else if (entry.isFile()) await cp(source, target);
  }
}

export async function workspaceDigest(root: string): Promise<string> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === '.senten') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk(root);
  files.sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(relative(root, file).replaceAll(sep, '/'));
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export async function createSnapshot(record: SandboxRecord, snapshotRoot: string, name?: string): Promise<SandboxSnapshotRecord> {
  const id = `snap_${randomUUID().slice(0, 8)}`;
  const root = join(snapshotRoot, id);
  await mkdir(dirname(root), { recursive: true });
  await cp(record.root, root, { recursive: true });
  return {
    id,
    sandboxId: record.id,
    name,
    root,
    createdAt: new Date().toISOString(),
    workspaceDigest: await workspaceDigest(root)
  };
}

export async function restoreSnapshot(snapshot: SandboxSnapshotRecord, targetRoot: string): Promise<void> {
  await rm(targetRoot, { recursive: true, force: true });
  await mkdir(dirname(targetRoot), { recursive: true });
  await cp(snapshot.root, targetRoot, { recursive: true });
}

export async function materializeSnapshot(snapshot: SandboxSnapshotRecord, targetRoot: string): Promise<void> {
  await mkdir(targetRoot, { recursive: true });
  await cp(snapshot.root, targetRoot, { recursive: true });
}

export function createSandboxRunRecord(sandbox: SandboxRecord, spec: SandboxRunSpec, result: SandboxRunResult, preSnapshotId?: string, workspaceDigestBefore?: string, workspaceDigestAfter?: string): SandboxRunRecord {
  const now = new Date().toISOString();
  return {
    id: `run_${randomUUID().slice(0, 8)}`,
    sandboxId: sandbox.id,
    provider: sandbox.provider,
    command: spec.command,
    args: spec.args ?? [],
    cwd: spec.cwd,
    environmentKeys: Object.keys(spec.env ?? {}),
    startedAt: new Date(Date.now() - result.durationMs).toISOString(),
    endedAt: now,
    code: result.code,
    timedOut: result.timedOut,
    truncated: result.truncated,
    stdoutHash: createHash('sha256').update(result.stdout).digest('hex'),
    stderrHash: createHash('sha256').update(result.stderr).digest('hex'),
    preSnapshotId,
    workspaceDigestBefore,
    workspaceDigestAfter
  };
}

export function syntheticSecretValue(name: string): string {
  return `senten_synthetic_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${randomBytes(12).toString('hex')}`;
}

export async function providerFor(kind: SandboxProviderKind): Promise<SandboxProvider> {
  return kind === 'docker' ? new DockerSandboxProvider() : new LocalSandboxProvider();
}

export async function expiredSandbox(record: SandboxRecord): Promise<boolean> {
  return !!record.expiresAt && Date.parse(record.expiresAt) <= Date.now();
}

function shouldExclude(name: string): boolean {
  if (PROJECT_EXCLUDES.has(name)) return true;
  if (name.startsWith('.env.')) return true;
  const lower = name.toLowerCase();
  return lower.endsWith('.pem') || lower.endsWith('.key') || lower === 'credentials.json' || lower.includes('secret');
}

async function writeSyntheticSecrets(root: string, names: string[]): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const name of names) if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) values[name] = syntheticSecretValue(name);
  if (Object.keys(values).length) {
    const path = join(root, '.senten-synthetic-secrets.json');
    await writeFile(path, JSON.stringify(values, null, 2), { mode: 0o600 });
  }
  return values;
}

async function readSyntheticSecrets(root: string): Promise<Record<string, string>> {
  try { return JSON.parse(await readFile(join(root, '.senten-synthetic-secrets.json'), 'utf8')) as Record<string, string>; }
  catch { return {}; }
}

function sanitizedEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of SAFE_ENV_KEYS) if (process.env[key] !== undefined) env[key] = process.env[key];
  return env;
}

function resolveSandboxCwd(root: string, cwd?: string): string {
  if (!cwd) return root;
  const candidate = resolve(root, cwd);
  const rel = relative(root, candidate);
  if (rel.startsWith('..') || resolve(candidate) === resolve(root, '..')) throw new Error('Sandbox cwd escapes workspace root.');
  return candidate;
}

function normalizeRelative(value: string): string {
  const normalized = value.replaceAll('\\', '/').replace(/^\/+/, '');
  if (normalized.split('/').includes('..')) throw new Error('Sandbox cwd cannot contain parent traversal.');
  return normalized;
}

function runProcess(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, limits: { timeoutMs?: number | undefined; maxOutputBytes?: number | undefined }, ignoreSpawnError = false): Promise<SandboxRunResult> {
  return new Promise((resolvePromise, reject) => {
    const started = Date.now();
    let settled = false;
    let timedOut = false;
    let truncated = false;
    const maxOutput = limits.maxOutputBytes ?? 1_000_000;
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true });
    let stdout = ''; let stderr = '';
    const append = (current: string, chunk: unknown): string => {
      if (Buffer.byteLength(current) >= maxOutput) { truncated = true; return current; }
      const next = current + String(chunk);
      if (Buffer.byteLength(next) <= maxOutput) return next;
      truncated = true;
      return Buffer.from(next).subarray(0, maxOutput).toString();
    };
    child.stdout?.on('data', (chunk: unknown) => { stdout = append(stdout, chunk); });
    child.stderr?.on('data', (chunk: unknown) => { stderr = append(stderr, chunk); });
    const timer = limits.timeoutMs ? setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, limits.timeoutMs) : undefined;
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (ignoreSpawnError) resolvePromise({ code: -1, stdout, stderr: String(error), durationMs: Date.now() - started, timedOut, truncated });
      else reject(error);
    });
    child.on('close', (code: number | null) => {
      if (timer) clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolvePromise({ code: code ?? -1, stdout, stderr, durationMs: Date.now() - started, timedOut, truncated });
    });
  });
}

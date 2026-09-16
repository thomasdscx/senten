import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AgentProfile, AgentRunRecord, AssuranceCaseRecord, AssuranceExchangeRecord, ChangeBundle, CheckpointRecord, EvidenceRecord, InteractionEdgeRecord, InteractionFinding, InteractionNodeRecord, InteractionRunRecord, LaunchProofResultBundle, MemoryRecord, OperationEvent, OperationRecord, ProfileRecord, RuntimeObservationRecord, RuntimeTraceRecord, ReportRecord, SandboxRecord, SandboxRunRecord, SandboxSnapshotRecord, SessionRecord, TransactionRecord, WorkflowRunRecord } from '../../core/src/index.js';

export class LocalStateStore {
  private readonly db: DatabaseSync;
  constructor(public readonly path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
  }
  static async open(cwd: string): Promise<LocalStateStore> {
    const path = join(cwd, '.senten', 'senten.db');
    await mkdir(dirname(path), { recursive: true });
    return new LocalStateStore(path);
  }
  close(): void { this.db.close(); }
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS operation_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL, operation_id TEXT NOT NULL, type TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_events_operation ON operation_events(operation_id, seq);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS checkpoints (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS memory (id TEXT PRIMARY KEY, scope TEXT NOT NULL, scope_id TEXT, kind TEXT NOT NULL, subject TEXT, updated_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_memory_scope ON memory(scope, scope_id, kind, subject);
      CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workflow_runs (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, workflow TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow, started_at);
      CREATE TABLE IF NOT EXISTS sandboxes (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_sandboxes_status ON sandboxes(status, created_at);
      CREATE TABLE IF NOT EXISTS sandbox_runs (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, sandbox_id TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_sandbox_runs_sandbox ON sandbox_runs(sandbox_id, started_at);
      CREATE TABLE IF NOT EXISTS sandbox_snapshots (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, sandbox_id TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_sandbox_snapshots_sandbox ON sandbox_snapshots(sandbox_id, created_at);
      CREATE TABLE IF NOT EXISTS interaction_runs (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_interaction_runs_kind ON interaction_runs(kind, started_at);
      CREATE TABLE IF NOT EXISTS interaction_nodes (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_interaction_nodes_run ON interaction_nodes(run_id);
      CREATE TABLE IF NOT EXISTS interaction_edges (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_interaction_edges_run ON interaction_edges(run_id);
      CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_runs (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, agent_id TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id, started_at);
      CREATE TABLE IF NOT EXISTS change_bundles (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS interaction_findings (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, severity TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_interaction_findings_run ON interaction_findings(run_id,severity);
      CREATE TABLE IF NOT EXISTS runtime_observations (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, subject TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, trace_id TEXT, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_runtime_observations_subject ON runtime_observations(subject,timestamp);
      CREATE INDEX IF NOT EXISTS idx_runtime_observations_trace ON runtime_observations(trace_id,timestamp);
      CREATE TABLE IF NOT EXISTS runtime_traces (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_runtime_traces_started ON runtime_traces(started_at,status);
      CREATE TABLE IF NOT EXISTS evidence_records (id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, subject TEXT, status TEXT NOT NULL, source TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_evidence_subject ON evidence_records(subject,timestamp);
      CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence_records(status,timestamp);
      CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, kind TEXT NOT NULL, format TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at,kind);
      CREATE TABLE IF NOT EXISTS assurance_exchanges (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, peer TEXT NOT NULL, direction TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_assurance_exchanges_created ON assurance_exchanges(created_at,peer,direction);
      CREATE TABLE IF NOT EXISTS launchproof_results (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, source_bundle_id TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_launchproof_results_source ON launchproof_results(source_bundle_id,created_at);
      CREATE TABLE IF NOT EXISTS assurance_cases (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, status TEXT NOT NULL, json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_assurance_cases_status ON assurance_cases(status,updated_at);
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
    `);
    const current = Number((this.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version ?? 0);
    if (current < 10) {
      this.db.exec('PRAGMA user_version = 10;');
      this.db.prepare('INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)').run(10,'build-10-baseline',new Date().toISOString());
    }
  }
  putOperation(value: OperationRecord): void { this.db.prepare('INSERT OR REPLACE INTO operations(id, created_at, json) VALUES(?,?,?)').run(value.id, value.timestamp, JSON.stringify(value)); }
  getOperation(id: string): OperationRecord | undefined { const row = this.db.prepare('SELECT json FROM operations WHERE id=?').get(id) as { json: string } | undefined; return row ? JSON.parse(row.json) as OperationRecord : undefined; }
  listOperations(): OperationRecord[] { return (this.db.prepare('SELECT json FROM operations ORDER BY created_at ASC').all() as {json:string}[]).map(r => JSON.parse(r.json) as OperationRecord); }
  appendEvent(value: OperationEvent): number { const result = this.db.prepare('INSERT INTO operation_events(id, created_at, operation_id, type, json) VALUES(?,?,?,?,?)').run(value.id, value.timestamp, value.operationId, value.type, JSON.stringify(value)); return Number(result.lastInsertRowid); }
  listEvents(operationId?: string): OperationEvent[] { const rows = (operationId ? this.db.prepare('SELECT json FROM operation_events WHERE operation_id=? ORDER BY seq ASC').all(operationId) : this.db.prepare('SELECT json FROM operation_events ORDER BY seq ASC').all()) as {json:string}[]; return rows.map(r => JSON.parse(r.json) as OperationEvent); }
  currentOperationState(id: string): 'applied'|'undone'|'planned'|'failed'|undefined {
    const events = this.listEvents(id); if (!events.length) return undefined; const last = events.at(-1)!;
    if (last.type === 'operation.undone') return 'undone'; if (last.type === 'operation.failed') return 'failed'; if (last.type === 'operation.planned') return 'planned'; return 'applied';
  }
  latestAppliedOperation(filter?: (op: OperationRecord) => boolean): OperationRecord | undefined { return this.listOperations().filter(op => (!filter || filter(op)) && this.currentOperationState(op.id) === 'applied').at(-1); }
  putSession(value: SessionRecord): void { this.db.prepare('INSERT OR REPLACE INTO sessions(id, created_at, json) VALUES(?,?,?)').run(value.id, value.startedAt, JSON.stringify(value)); }
  getSession(id: string): SessionRecord | undefined { const r=this.db.prepare('SELECT json FROM sessions WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as SessionRecord:undefined; }
  listSessions(): SessionRecord[] { return (this.db.prepare('SELECT json FROM sessions ORDER BY created_at ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as SessionRecord); }
  putTransaction(value: TransactionRecord): void { this.db.prepare('INSERT OR REPLACE INTO transactions(id, created_at, json) VALUES(?,?,?)').run(value.id, value.createdAt, JSON.stringify(value)); }
  getTransaction(id:string):TransactionRecord|undefined { const r=this.db.prepare('SELECT json FROM transactions WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as TransactionRecord:undefined; }
  putCheckpoint(value: CheckpointRecord): void { this.db.prepare('INSERT OR REPLACE INTO checkpoints(id, created_at, json) VALUES(?,?,?)').run(value.id,value.createdAt,JSON.stringify(value)); }
  getCheckpoint(id:string):CheckpointRecord|undefined { const r=this.db.prepare('SELECT json FROM checkpoints WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as CheckpointRecord:undefined; }
  listCheckpoints():CheckpointRecord[] { return (this.db.prepare('SELECT json FROM checkpoints ORDER BY created_at ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as CheckpointRecord); }
  putMemory(value:MemoryRecord):void { this.db.prepare('INSERT OR REPLACE INTO memory(id,scope,scope_id,kind,subject,updated_at,json) VALUES(?,?,?,?,?,?,?)').run(value.id,value.scope,value.scopeId??null,value.kind,value.subject??null,value.updatedAt,JSON.stringify(value)); }
  listMemory(filters: {scope?:string; scopeId?:string; kind?:string; subject?:string} = {}):MemoryRecord[] { let sql='SELECT json FROM memory WHERE 1=1'; const args:string[]=[]; for (const [col,val] of [['scope',filters.scope],['scope_id',filters.scopeId],['kind',filters.kind],['subject',filters.subject]] as const) if(val){sql+=` AND ${col}=?`;args.push(val);} sql+=' ORDER BY updated_at ASC'; return (this.db.prepare(sql).all(...args) as {json:string}[]).map(r=>JSON.parse(r.json) as MemoryRecord); }
  deleteMemory(id:string):void { this.db.prepare('DELETE FROM memory WHERE id=?').run(id); }
  putProfile(value:ProfileRecord):void { this.db.prepare('INSERT OR REPLACE INTO profiles(id,updated_at,json) VALUES(?,?,?)').run(value.id,value.updatedAt,JSON.stringify(value)); }
  getProfile(id:string):ProfileRecord|undefined { const r=this.db.prepare('SELECT json FROM profiles WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as ProfileRecord:undefined; }
  listProfiles():ProfileRecord[] { return (this.db.prepare('SELECT json FROM profiles ORDER BY id ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as ProfileRecord); }
  putWorkflowRun(value:WorkflowRunRecord):void { this.db.prepare('INSERT OR REPLACE INTO workflow_runs(id,started_at,workflow,status,json) VALUES(?,?,?,?,?)').run(value.id,value.startedAt,value.workflow,value.status,JSON.stringify(value)); }
  getWorkflowRun(id:string):WorkflowRunRecord|undefined { const r=this.db.prepare('SELECT json FROM workflow_runs WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as WorkflowRunRecord:undefined; }
  listWorkflowRuns(workflow?:string):WorkflowRunRecord[] { const rows=(workflow?this.db.prepare('SELECT json FROM workflow_runs WHERE workflow=? ORDER BY started_at ASC').all(workflow):this.db.prepare('SELECT json FROM workflow_runs ORDER BY started_at ASC').all()) as {json:string}[]; return rows.map(r=>JSON.parse(r.json) as WorkflowRunRecord); }
  putSandbox(value:SandboxRecord):void { this.db.prepare('INSERT OR REPLACE INTO sandboxes(id,created_at,status,json) VALUES(?,?,?,?)').run(value.id,value.createdAt,value.status,JSON.stringify(value)); }
  getSandbox(id:string):SandboxRecord|undefined { const r=this.db.prepare('SELECT json FROM sandboxes WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as SandboxRecord:undefined; }
  listSandboxes():SandboxRecord[] { return (this.db.prepare('SELECT json FROM sandboxes ORDER BY created_at ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as SandboxRecord); }
  putSandboxRun(value:SandboxRunRecord):void { this.db.prepare('INSERT OR REPLACE INTO sandbox_runs(id,started_at,sandbox_id,json) VALUES(?,?,?,?)').run(value.id,value.startedAt,value.sandboxId,JSON.stringify(value)); }
  getSandboxRun(id:string):SandboxRunRecord|undefined { const r=this.db.prepare('SELECT json FROM sandbox_runs WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as SandboxRunRecord:undefined; }
  listSandboxRuns(sandboxId?:string):SandboxRunRecord[] { const rows=(sandboxId?this.db.prepare('SELECT json FROM sandbox_runs WHERE sandbox_id=? ORDER BY started_at ASC').all(sandboxId):this.db.prepare('SELECT json FROM sandbox_runs ORDER BY started_at ASC').all()) as {json:string}[]; return rows.map(r=>JSON.parse(r.json) as SandboxRunRecord); }
  putSandboxSnapshot(value:SandboxSnapshotRecord):void { this.db.prepare('INSERT OR REPLACE INTO sandbox_snapshots(id,created_at,sandbox_id,json) VALUES(?,?,?,?)').run(value.id,value.createdAt,value.sandboxId,JSON.stringify(value)); }
  getSandboxSnapshot(id:string):SandboxSnapshotRecord|undefined { const r=this.db.prepare('SELECT json FROM sandbox_snapshots WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as SandboxSnapshotRecord:undefined; }
  listSandboxSnapshots(sandboxId?:string):SandboxSnapshotRecord[] { const rows=(sandboxId?this.db.prepare('SELECT json FROM sandbox_snapshots WHERE sandbox_id=? ORDER BY created_at ASC').all(sandboxId):this.db.prepare('SELECT json FROM sandbox_snapshots ORDER BY created_at ASC').all()) as {json:string}[]; return rows.map(r=>JSON.parse(r.json) as SandboxSnapshotRecord); }

  putAgent(value:AgentProfile):void { this.db.prepare('INSERT OR REPLACE INTO agents(id,updated_at,json) VALUES(?,?,?)').run(value.id,value.updatedAt,JSON.stringify(value)); }
  getAgent(id:string):AgentProfile|undefined { const r=this.db.prepare('SELECT json FROM agents WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as AgentProfile:undefined; }
  listAgents():AgentProfile[] { return (this.db.prepare('SELECT json FROM agents ORDER BY id ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as AgentProfile); }
  putAgentRun(value:AgentRunRecord):void { this.db.prepare('INSERT OR REPLACE INTO agent_runs(id,started_at,agent_id,status,json) VALUES(?,?,?,?,?)').run(value.id,value.startedAt,value.agentId,value.status,JSON.stringify(value)); }
  getAgentRun(id:string):AgentRunRecord|undefined { const r=this.db.prepare('SELECT json FROM agent_runs WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as AgentRunRecord:undefined; }
  listAgentRuns(agentId?:string):AgentRunRecord[] { const rows=(agentId?this.db.prepare('SELECT json FROM agent_runs WHERE agent_id=? ORDER BY started_at ASC').all(agentId):this.db.prepare('SELECT json FROM agent_runs ORDER BY started_at ASC').all()) as {json:string}[]; return rows.map(r=>JSON.parse(r.json) as AgentRunRecord); }
  putChangeBundle(value:ChangeBundle):void { this.db.prepare('INSERT OR REPLACE INTO change_bundles(id,created_at,json) VALUES(?,?,?)').run(value.id,value.createdAt,JSON.stringify(value)); }
  getChangeBundle(id:string):ChangeBundle|undefined { const r=this.db.prepare('SELECT json FROM change_bundles WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as ChangeBundle:undefined; }
  listChangeBundles():ChangeBundle[] { return (this.db.prepare('SELECT json FROM change_bundles ORDER BY created_at ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as ChangeBundle); }

  putInteractionRun(value:InteractionRunRecord):void { this.db.prepare('INSERT OR REPLACE INTO interaction_runs(id,started_at,kind,status,json) VALUES(?,?,?,?,?)').run(value.id,value.startedAt,value.kind,value.status,JSON.stringify(value)); }
  getInteractionRun(id:string):InteractionRunRecord|undefined { const r=this.db.prepare('SELECT json FROM interaction_runs WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as InteractionRunRecord:undefined; }
  listInteractionRuns(kind?:string):InteractionRunRecord[] { const rows=(kind?this.db.prepare('SELECT json FROM interaction_runs WHERE kind=? ORDER BY started_at ASC').all(kind):this.db.prepare('SELECT json FROM interaction_runs ORDER BY started_at ASC').all()) as {json:string}[]; return rows.map(r=>JSON.parse(r.json) as InteractionRunRecord); }
  putInteractionNode(value:InteractionNodeRecord):void { this.db.prepare('INSERT OR REPLACE INTO interaction_nodes(id,run_id,json) VALUES(?,?,?)').run(value.id,value.runId,JSON.stringify(value)); }
  listInteractionNodes(runId:string):InteractionNodeRecord[] { return (this.db.prepare('SELECT json FROM interaction_nodes WHERE run_id=? ORDER BY id ASC').all(runId) as {json:string}[]).map(r=>JSON.parse(r.json) as InteractionNodeRecord); }
  putInteractionEdge(value:InteractionEdgeRecord):void { this.db.prepare('INSERT OR REPLACE INTO interaction_edges(id,run_id,json) VALUES(?,?,?)').run(value.id,value.runId,JSON.stringify(value)); }
  listInteractionEdges(runId:string):InteractionEdgeRecord[] { return (this.db.prepare('SELECT json FROM interaction_edges WHERE run_id=? ORDER BY id ASC').all(runId) as {json:string}[]).map(r=>JSON.parse(r.json) as InteractionEdgeRecord); }
  putInteractionFinding(value:InteractionFinding):void { this.db.prepare('INSERT OR REPLACE INTO interaction_findings(id,run_id,severity,json) VALUES(?,?,?,?)').run(value.id,value.runId,value.severity,JSON.stringify(value)); }
  listInteractionFindings(runId:string):InteractionFinding[] { return (this.db.prepare('SELECT json FROM interaction_findings WHERE run_id=? ORDER BY id ASC').all(runId) as {json:string}[]).map(r=>JSON.parse(r.json) as InteractionFinding); }

  putRuntimeObservation(value:RuntimeObservationRecord):void { this.db.prepare('INSERT OR REPLACE INTO runtime_observations(id,timestamp,subject,kind,status,trace_id,json) VALUES(?,?,?,?,?,?,?)').run(value.id,value.timestamp,value.subject,value.kind,value.status,value.traceId??null,JSON.stringify(value)); }
  getRuntimeObservation(id:string):RuntimeObservationRecord|undefined { const r=this.db.prepare('SELECT json FROM runtime_observations WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as RuntimeObservationRecord:undefined; }
  listRuntimeObservations(filters:{subject?:string;traceId?:string;kind?:string;status?:string}={}):RuntimeObservationRecord[] { let sql='SELECT json FROM runtime_observations WHERE 1=1'; const args:string[]=[]; for(const [col,val] of [['subject',filters.subject],['trace_id',filters.traceId],['kind',filters.kind],['status',filters.status]] as const){if(val){sql+=` AND ${col}=?`;args.push(val);}} sql+=' ORDER BY timestamp ASC'; return (this.db.prepare(sql).all(...args) as {json:string}[]).map(r=>JSON.parse(r.json) as RuntimeObservationRecord); }
  putRuntimeTrace(value:RuntimeTraceRecord):void { this.db.prepare('INSERT OR REPLACE INTO runtime_traces(id,started_at,status,json) VALUES(?,?,?,?)').run(value.id,value.startedAt,value.status,JSON.stringify(value)); }
  getRuntimeTrace(id:string):RuntimeTraceRecord|undefined { const r=this.db.prepare('SELECT json FROM runtime_traces WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as RuntimeTraceRecord:undefined; }
  listRuntimeTraces():RuntimeTraceRecord[] { return (this.db.prepare('SELECT json FROM runtime_traces ORDER BY started_at ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as RuntimeTraceRecord); }
  putEvidence(value:EvidenceRecord):void { this.db.prepare('INSERT OR REPLACE INTO evidence_records(id,timestamp,subject,status,source,json) VALUES(?,?,?,?,?,?)').run(value.id,value.timestamp,value.subject??null,value.status,value.source,JSON.stringify(value)); }
  getEvidence(id:string):EvidenceRecord|undefined { const r=this.db.prepare('SELECT json FROM evidence_records WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as EvidenceRecord:undefined; }
  listEvidence(filters:{subject?:string;status?:string;source?:string}={}):EvidenceRecord[] { let sql='SELECT json FROM evidence_records WHERE 1=1'; const args:string[]=[]; for(const [col,val] of [['subject',filters.subject],['status',filters.status],['source',filters.source]] as const){if(val){sql+=` AND ${col}=?`;args.push(val);}} sql+=' ORDER BY timestamp ASC'; return (this.db.prepare(sql).all(...args) as {json:string}[]).map(r=>JSON.parse(r.json) as EvidenceRecord); }
  putReport(value:ReportRecord):void { this.db.prepare('INSERT OR REPLACE INTO reports(id,created_at,kind,format,json) VALUES(?,?,?,?,?)').run(value.id,value.createdAt,value.kind,value.format,JSON.stringify(value)); }
  getReport(id:string):ReportRecord|undefined { const r=this.db.prepare('SELECT json FROM reports WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as ReportRecord:undefined; }
  listReports(kind?:string):ReportRecord[] { const rows=(kind?this.db.prepare('SELECT json FROM reports WHERE kind=? ORDER BY created_at ASC').all(kind):this.db.prepare('SELECT json FROM reports ORDER BY created_at ASC').all()) as {json:string}[]; return rows.map(r=>JSON.parse(r.json) as ReportRecord); }

  putAssuranceExchange(value:AssuranceExchangeRecord):void { this.db.prepare('INSERT OR REPLACE INTO assurance_exchanges(id,created_at,peer,direction,status,json) VALUES(?,?,?,?,?,?)').run(value.id,value.createdAt,value.peer,value.direction,value.status,JSON.stringify(value)); }
  getAssuranceExchange(id:string):AssuranceExchangeRecord|undefined { const r=this.db.prepare('SELECT json FROM assurance_exchanges WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as AssuranceExchangeRecord:undefined; }
  listAssuranceExchanges():AssuranceExchangeRecord[] { return (this.db.prepare('SELECT json FROM assurance_exchanges ORDER BY created_at ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as AssuranceExchangeRecord); }
  putLaunchProofResult(value:LaunchProofResultBundle):void { this.db.prepare('INSERT OR REPLACE INTO launchproof_results(id,created_at,source_bundle_id,json) VALUES(?,?,?,?)').run(value.id,value.generatedAt,value.sourceBundleId,JSON.stringify(value)); }
  getLaunchProofResult(id:string):LaunchProofResultBundle|undefined { const r=this.db.prepare('SELECT json FROM launchproof_results WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as LaunchProofResultBundle:undefined; }
  listLaunchProofResults():LaunchProofResultBundle[] { return (this.db.prepare('SELECT json FROM launchproof_results ORDER BY created_at ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as LaunchProofResultBundle); }
  putAssuranceCase(value:AssuranceCaseRecord):void { this.db.prepare('INSERT OR REPLACE INTO assurance_cases(id,updated_at,status,json) VALUES(?,?,?,?)').run(value.id,value.updatedAt,value.status,JSON.stringify(value)); }
  getAssuranceCase(id:string):AssuranceCaseRecord|undefined { const r=this.db.prepare('SELECT json FROM assurance_cases WHERE id=?').get(id) as {json:string}|undefined; return r?JSON.parse(r.json) as AssuranceCaseRecord:undefined; }
  listAssuranceCases():AssuranceCaseRecord[] { return (this.db.prepare('SELECT json FROM assurance_cases ORDER BY updated_at ASC').all() as {json:string}[]).map(r=>JSON.parse(r.json) as AssuranceCaseRecord); }

  set(key:string,value:string):void { this.db.prepare('INSERT OR REPLACE INTO kv(key,value,updated_at) VALUES(?,?,?)').run(key,value,new Date().toISOString()); }
  get(key:string):string|undefined { const r=this.db.prepare('SELECT value FROM kv WHERE key=?').get(key) as {value:string}|undefined; return r?.value; }
  eventCount():number { const r=this.db.prepare('SELECT COUNT(*) AS n FROM operation_events').get() as {n:number}; return r.n; }
  integrityCheck():string { const r=this.db.prepare('PRAGMA integrity_check').get() as {integrity_check:string}; return r.integrity_check; }
  schemaVersion():number { const r=this.db.prepare('PRAGMA user_version').get() as {user_version:number}; return Number(r.user_version??0); }
  listMigrations():Array<{version:number;name:string;appliedAt:string}> { return (this.db.prepare('SELECT version,name,applied_at FROM schema_migrations ORDER BY version').all() as Array<{version:number;name:string;applied_at:string}>).map(r=>({version:r.version,name:r.name,appliedAt:r.applied_at})); }
}

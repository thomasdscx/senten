export type ElementKind =
  | 'file' | 'dir' | 'component' | 'route' | 'resource' | 'action' | 'policy'
  | 'feature' | 'asset' | 'test' | 'provider' | 'invariant' | 'capability' | 'state'
  | 'actor' | 'event' | 'workflow' | 'template' | 'blueprint' | 'profile' | 'skill'
  | 'decision' | 'checkpoint' | 'session' | 'transaction' | 'journey' | 'interaction' | 'unknown';

export interface UniversalElementRef { kind: ElementKind; id: string; raw: string; }
export type SemanticNodeKind = Exclude<ElementKind, 'dir' | 'unknown'> | 'application' | 'query' | 'effect' | 'evidence' | 'owner' | 'ui' | 'module' | 'symbol';
export interface SemanticNode { id: string; kind: SemanticNodeKind; label?: string; source?: string; metadata?: Record<string, unknown>; }
export interface SemanticEdge { from: string; to: string; relation: string; metadata?: Record<string, unknown>; }
export interface ApplicationIR { schemaVersion: '0.1'; application: { id: string; name: string; version?: string }; nodes: SemanticNode[]; edges: SemanticEdge[]; generatedAt: string; }
export interface PolicyDecision { policyId: string; effect: 'allow' | 'deny' | 'unknown'; reason?: string; }
export type EvidenceStatus = 'declared' | 'observed' | 'tested' | 'verified' | 'unknown' | 'failed';
export type EvidenceStrength = 0 | 1 | 2 | 3 | 4;
export interface EvidenceRecord { id: string; claim: string; source: string; status: EvidenceStatus; timestamp: string; subject?: string; evidenceType?: 'declaration'|'runtime'|'test'|'verification'|'interaction'|'manual'; strength?: EvidenceStrength; traceId?: string; runtimeObservationId?: string; environment?: string; provenance?: Record<string, unknown>; metadata?: Record<string, unknown>; }

export type RuntimeObservationKind = 'trace'|'action'|'state-transition'|'invariant'|'policy'|'effect'|'error'|'custom';
export type RuntimeObservationStatus = 'started'|'observed'|'passed'|'failed'|'denied'|'unknown';
export interface RuntimeObservationRecord {
  id: string;
  traceId?: string;
  parentId?: string;
  kind: RuntimeObservationKind;
  subject: string;
  status: RuntimeObservationStatus;
  timestamp: string;
  endedAt?: string;
  durationMs?: number;
  environment: string;
  source: string;
  actor?: ActorIdentity;
  inputHash?: string;
  outputHash?: string;
  metadata?: Record<string, unknown>;
}
export interface RuntimeTraceRecord { id:string; name:string; environment:string; source:string; startedAt:string; endedAt?:string; status:'running'|'passed'|'failed'|'unknown'; observationIds:string[]; actor?:ActorIdentity; metadata?:Record<string,unknown>; }
export interface EvidenceSummary { subject?:string; total:number; declared:number; observed:number; tested:number; verified:number; failed:number; unknown:number; strongest:EvidenceStatus; strength:EvidenceStrength; latestAt?:string; }
export interface GuaranteeResult { target:string; status:'verified'|'supported'|'observed'|'declared'|'failed'|'unknown'; reason:string; evidence:EvidenceRecord[]; strongest:EvidenceStatus; strength:EvidenceStrength; }
export interface RuntimeAlignmentReport { observedSubjects:number; declaredSubjects:number; matched:number; runtimeOnly:string[]; unobserved:string[]; failures:RuntimeObservationRecord[]; coverage:number; }


export interface AssuranceClaim {
  id: string;
  subject: string;
  kind: 'invariant'|'policy'|'action'|'route'|'resource'|'custom';
  statement: string;
  source: string;
  metadata?: Record<string, unknown>;
}
export interface AssuranceExchangeBundle {
  schemaVersion: '0.1';
  kind: 'senten-assurance-exchange';
  id: string;
  generatedAt: string;
  sentenVersion: string;
  application: ApplicationIR['application'];
  stateTrussDigest: string;
  claims: AssuranceClaim[];
  evidence: EvidenceRecord[];
  provenance: { producer: 'Senten'; evidencePolicy: 'evidence-before-ai'; unknownIsPass: false; environment?: string };
  digest: string;
}
export interface LaunchProofClaimResult {
  claimId: string;
  subject: string;
  outcome: 'verified'|'failed'|'unknown'|'inconclusive';
  reason?: string;
  checks?: Array<{ id:string; name?:string; status:'passed'|'failed'|'unknown'; evidenceRefs?:string[]; metadata?:Record<string,unknown> }>;
  evidenceRefs?: string[];
  metadata?: Record<string, unknown>;
}
export interface LaunchProofResultBundle {
  schemaVersion: '0.1';
  kind: 'launchproof-verification-result';
  id: string;
  generatedAt: string;
  sourceBundleId: string;
  sourceBundleDigest: string;
  verifier: { name: 'LaunchProof'; version?: string; executionId?: string };
  results: LaunchProofClaimResult[];
  signature?: { algorithm:'ed25519'; keyId:string; publisher?:string; publicKey:string; signature:string; signedDigest:string; createdAt:string };
  metadata?: Record<string, unknown>;
}
export interface AssuranceExchangeRecord {
  id: string;
  createdAt: string;
  direction: 'export'|'import';
  peer: 'launchproof';
  bundleId: string;
  bundleDigest: string;
  artifactPath?: string;
  status: 'created'|'verified'|'rejected';
  metadata?: Record<string, unknown>;
}
export interface AssuranceCaseRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  claimIds: string[];
  status: 'incomplete'|'supported'|'verified'|'failed';
  evidenceIds: string[];
  verificationResultIds: string[];
  metadata?: Record<string, unknown>;
}


export type ActorType = 'human' | 'agent' | 'automation' | 'extension' | 'system';
export interface ActorIdentity { type: ActorType; id: string; name?: string; }
export type Reversibility = 'reversible' | 'compensatable' | 'snapshot' | 'irreversible';
export type OperationEventType = 'operation.applied' | 'operation.planned' | 'operation.failed' | 'operation.undone' | 'operation.redone';

export interface OperationRecord {
  id: string;
  timestamp: string;
  actor: ActorIdentity;
  intent: string;
  action: string;
  targets: string[];
  environment: string;
  dryRun: boolean;
  status: 'planned' | 'applied' | 'failed';
  reversibility: Reversibility;
  sessionId?: string;
  transactionId?: string;
  branch?: string;
  gitCommit?: string;
  rollback?: RollbackRecipe;
  metadata?: Record<string, unknown> | undefined;
}

export interface OperationEvent {
  id: string;
  type: OperationEventType;
  timestamp: string;
  actor: ActorIdentity;
  operationId: string;
  inverseOf?: string;
  replays?: string;
  metadata?: Record<string, unknown> | undefined;
}

export type RollbackRecipe =
  | { type: 'move'; from: string; to: string }
  | { type: 'delete-created'; path: string; expectedHash?: string }
  | { type: 'restore-file'; path: string; contentBase64: string; deletedHash?: string }
  | { type: 'none'; reason: string };

export interface SessionRecord { id: string; name: string; actor: ActorIdentity; startedAt: string; endedAt?: string; status: 'active' | 'ended'; metadata?: Record<string, unknown>; }
export interface TransactionRecord { id: string; sessionId?: string; name: string; createdAt: string; actor: ActorIdentity; operationIds: string[]; status: 'open' | 'closed'; }
export interface CheckpointRecord { id: string; name: string; createdAt: string; actor: ActorIdentity; operationEventCursor: number; branch?: string; metadata?: Record<string, unknown>; }

export type MemoryScope = 'global' | 'profile' | 'team' | 'template' | 'project' | 'branch' | 'session' | 'agent' | 'element';
export type MemoryKind = 'rule' | 'decision' | 'convention' | 'instruction' | 'skill' | 'fact' | 'preference' | 'context';
export interface MemoryRecord { id: string; kind: MemoryKind; scope: MemoryScope; scopeId?: string; subject?: string; value: string; source: string; actor: ActorIdentity; createdAt: string; updatedAt: string; expiresAt?: string; confidence?: number; status: 'active' | 'superseded' | 'expired'; metadata?: Record<string, unknown>; }

export interface ProfileRecord { id: string; name: string; description?: string; settings: Record<string, unknown>; createdAt: string; updatedAt: string; }
export type PackageKind = 'adapter' | 'integration' | 'template' | 'blueprint' | 'profile' | 'workflow' | 'skill' | 'provider' | 'policy-pack' | 'journey';

export type InteractionSeverity = 'info'|'warning'|'error';
export interface InteractionNodeRecord { id:string; runId:string; url:string; kind:'page'|'button'|'form'|'input'|'control'; label?:string; status?:number; title?:string; metadata?:Record<string,unknown>; }
export interface InteractionEdgeRecord { id:string; runId:string; from:string; to:string; kind:'link'|'contains'|'navigation'|'interaction'; label?:string; metadata?:Record<string,unknown>; }
export interface InteractionFinding { id:string; runId:string; severity:InteractionSeverity; kind:string; url:string; message:string; element?:string; metadata?:Record<string,unknown>; }
export interface InteractionRunRecord { id:string; kind:'crawl'|'clickthru'|'journey'; target:string; engine:string; startedAt:string; endedAt:string; status:'passed'|'failed'|'planned'; pages:number; interactions:number; findings:number; metadata?:Record<string,unknown>; }
export type JourneyStepType='goto'|'click'|'fill'|'press'|'expect-url'|'expect-text'|'expect-visible';
export interface JourneyStep { id?:string; type:JourneyStepType; selector?:string; value?:string; timeoutMs?:number; }
export interface JourneyDefinition { senten:1; kind:'journey'; name:string; version:string; description?:string; baseUrl?:string; inputs?:Record<string,{required?:boolean;default?:string;description?:string}>; steps:JourneyStep[]; metadata?:Record<string,unknown>; }
export interface JourneyStepResult { index:number; id:string; type:JourneyStepType; status:'passed'|'failed'|'skipped'; startedAt:string; endedAt:string; error?:string; }
export interface SentenPackageManifest { senten: 1; kind: PackageKind; name: string; namespace?: string; version: string; publisher?: string; description?: string; sentenVersion?: string; capabilities?: string[]; dependencies?: string[]; files?: string[]; variables?: Record<string, { required?: boolean; default?: string; description?: string }>; integrity?: { algorithm: 'sha256'; files: Record<string,string>; packageDigest: string }; compatibility?: { senten?: string; node?: string; extensions?: Record<string,string> }; signatures?: Array<{ algorithm:'ed25519'; keyId:string; publisher?:string; publicKey:string; signature:string; signedDigest:string; createdAt:string }>; metadata?: Record<string, unknown>; }

export type WorkflowFailurePolicy = 'stop' | 'continue' | 'rollback';
export type WorkflowCondition = 'always' | 'previous.success' | 'previous.failed' | string;
export interface WorkflowInputDefinition { required?: boolean; default?: string; description?: string; }
export interface WorkflowStep {
  id?: string;
  command?: string;
  args?: string[];
  workflow?: string;
  if?: WorkflowCondition;
  onFailure?: WorkflowFailurePolicy;
}
export interface WorkflowDefinition {
  senten: 1;
  kind: 'workflow';
  name: string;
  version: string;
  description?: string;
  inputs?: Record<string, WorkflowInputDefinition>;
  onFailure?: WorkflowFailurePolicy;
  steps: WorkflowStep[];
  metadata?: Record<string, unknown> | undefined;
}
export interface WorkflowStepResult { id: string; index: number; command: string; status: 'planned'|'passed'|'failed'|'skipped'; startedAt: string; endedAt: string; error?: string; }
export interface WorkflowRunRecord {
  id: string; workflow: string; version: string; actor: ActorIdentity; startedAt: string; endedAt?: string; status: 'running'|'planned'|'passed'|'failed'|'rolled-back';
  inputs: Record<string,string>; dryRun: boolean; operationEventCursor: number; operationIds: string[]; steps: WorkflowStepResult[]; error?: string;
}


export interface SandboxRecord {
  id: string;
  provider: 'local' | 'docker';
  isolation: 'workspace-copy' | 'container';
  root: string;
  projectRoot: string;
  environmentName: string;
  network: 'inherit' | 'deny';
  status: 'active' | 'destroyed' | 'expired' | 'failed';
  createdAt: string;
  expiresAt?: string | undefined;
  containerId?: string | undefined;
  dockerImage?: string | undefined;
  syntheticSecretNames?: string[] | undefined;
  budget?: { timeoutMs?: number | undefined; maxOutputBytes?: number | undefined; memoryMb?: number | undefined; cpus?: number | undefined; pids?: number | undefined } | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface SandboxSnapshotRecord {
  id: string;
  sandboxId: string;
  name?: string | undefined;
  root: string;
  createdAt: string;
  workspaceDigest: string;
}

export interface SandboxRunRecord {
  id: string;
  sandboxId: string;
  provider: 'local' | 'docker';
  command: string;
  args: string[];
  cwd?: string | undefined;
  environmentKeys: string[];
  startedAt: string;
  endedAt: string;
  code: number;
  timedOut: boolean;
  truncated: boolean;
  stdoutHash: string;
  stderrHash: string;
  preSnapshotId?: string | undefined;
  workspaceDigestBefore?: string | undefined;
  workspaceDigestAfter?: string | undefined;
  reproducedFrom?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}


export type AgentStatus = 'active' | 'disabled';
export interface AgentGrant { id:string; effect:'allow'|'deny'; capability:string; target?:string; createdAt:string; actor:ActorIdentity; }
export interface AgentProfile { id:string; name:string; provider?:string; model?:string; description?:string; status:AgentStatus; grants:AgentGrant[]; createdAt:string; updatedAt:string; metadata?:Record<string,unknown>; }
export interface TaskContextBundle { id:string; task:string; agentId?:string; generatedAt:string; application:{id:string;name:string}; semantic:{nodes:SemanticNode[]; edges:SemanticEdge[]}; memory:MemoryRecord[]; recentOperations:OperationRecord[]; constraints:string[]; permissions:{allow:string[];deny:string[]}; sourceDigest:string; metadata?:Record<string,unknown>; }
export interface AgentRunRecord { id:string; agentId:string; task?:string; command:string; args:string[]; startedAt:string; endedAt?:string; status:'running'|'passed'|'failed'|'denied'; contextBundleId?:string; sessionId?:string; operationIds:string[]; error?:string; metadata?:Record<string,unknown>; }
export interface ChangeBundle { id:string; agentRunId?:string; createdAt:string; intent:string; operations:OperationRecord[]; semanticChanges?:Record<string,unknown>; tests?:string[]; invariants?:string[]; securityImpact?:string[]; provenance:{actor:ActorIdentity; agentId?:string; contextBundleId?:string}; }


export interface ReportRecord { id:string; kind:'project'|'architecture'|'evidence'|'assurance'|'runtime'|'interactions'|'agents'|'operations'; format:'json'|'md'|'html'; createdAt:string; path:string; digest:string; applicationId:string; metadata?:Record<string,unknown>; }

export interface RegistryConfig { name: string; type: 'local' | 'http'; location: string; trusted?: boolean; }
export interface SentenConfig { application: { id: string; name: string; version?: string }; environment?: string; extensions?: string[]; profile?: string; registries?: RegistryConfig[]; source?: { include?: string[]; exclude?: string[]; autoDiscover?: boolean }; }

const validKinds: ElementKind[] = ['file','dir','component','route','resource','action','policy','feature','asset','test','provider','invariant','capability','state','actor','event','workflow','template','blueprint','profile','skill','decision','checkpoint','session','transaction','journey','interaction','unknown'];
export function parseElementRef(input: string): UniversalElementRef {
  const idx = input.indexOf(':');
  if (idx > 0) { const candidate = input.slice(0, idx) as ElementKind; if (validKinds.includes(candidate)) return { kind: candidate, id: input.slice(idx + 1), raw: input }; }
  return { kind: 'unknown', id: input, raw: input };
}
export function semanticId(kind: SemanticNodeKind, id: string): string { return `${kind}:${id}`; }
export function actorFromString(value = 'human:local'): ActorIdentity {
  const idx = value.indexOf(':');
  if (idx < 0) return { type: 'human', id: value };
  const type = value.slice(0, idx) as ActorType;
  const id = value.slice(idx + 1);
  const allowed: ActorType[] = ['human','agent','automation','extension','system'];
  return { type: allowed.includes(type) ? type : 'human', id: id || 'local' };
}

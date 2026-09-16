import { createHash, randomUUID } from 'node:crypto';
import type {
  ApplicationIR,
  EvidenceRecord,
  EvidenceStatus,
  EvidenceStrength,
  EvidenceSummary,
  GuaranteeResult,
  RuntimeAlignmentReport,
  RuntimeObservationRecord,
  RuntimeObservationStatus,
  RuntimeTraceRecord
} from '../../core/src/index.js';

const strengthByStatus: Record<EvidenceStatus, EvidenceStrength> = {
  unknown: 0,
  declared: 1,
  observed: 2,
  tested: 3,
  verified: 4,
  failed: 0
};

export function evidenceStrength(status: EvidenceStatus): EvidenceStrength {
  return strengthByStatus[status];
}

export function runtimeStatusToEvidence(status: RuntimeObservationStatus): EvidenceStatus {
  switch (status) {
    case 'passed': return 'observed';
    case 'failed':
    case 'denied': return 'failed';
    case 'observed':
    case 'started': return 'observed';
    default: return 'unknown';
  }
}

export function observationToEvidence(observation: RuntimeObservationRecord): EvidenceRecord {
  const status = runtimeStatusToEvidence(observation.status);
  const kindLabel = observation.kind.replace('-', ' ');
  return {
    id: `ev_${createHash('sha256').update(`${observation.id}|${observation.subject}|${observation.timestamp}`).digest('hex').slice(0,16)}`,
    subject: observation.subject,
    claim: `${kindLabel} ${observation.subject} was ${observation.status}`,
    source: observation.source,
    status,
    timestamp: observation.timestamp,
    evidenceType: 'runtime',
    strength: evidenceStrength(status),
    ...(observation.traceId ? { traceId: observation.traceId } : {}),
    runtimeObservationId: observation.id,
    environment: observation.environment,
    ...(observation.actor ? { provenance: { actor: observation.actor } } : {}),
    metadata: { kind: observation.kind, runtimeStatus: observation.status, ...observation.metadata }
  };
}

export function normalizeEvidence(record: EvidenceRecord): EvidenceRecord {
  return { ...record, strength: record.strength ?? evidenceStrength(record.status) };
}

export function summarizeEvidence(records: EvidenceRecord[], subject?: string): EvidenceSummary {
  const filtered = subject ? records.filter(r => r.subject === subject) : records;
  const counts: Record<EvidenceStatus, number> = { declared:0, observed:0, tested:0, verified:0, failed:0, unknown:0 };
  for (const record of filtered) counts[record.status]++;
  const sorted = [...filtered].sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  let strongest: EvidenceStatus = 'unknown';
  let strength: EvidenceStrength = 0;
  for (const record of filtered) {
    if (record.status === 'failed') continue;
    const s = record.strength ?? evidenceStrength(record.status);
    if (s > strength) { strength = s; strongest = record.status; }
  }
  if (counts.failed > 0) strongest = 'failed';
  return {
    ...(subject ? { subject } : {}), total: filtered.length,
    declared: counts.declared, observed: counts.observed, tested: counts.tested,
    verified: counts.verified, failed: counts.failed, unknown: counts.unknown,
    strongest, strength, ...(sorted.at(-1)?.timestamp ? { latestAt: sorted.at(-1)!.timestamp } : {})
  };
}

export function evaluateGuarantee(target: string, evidence: EvidenceRecord[], ir?: ApplicationIR): GuaranteeResult {
  const records = evidence.filter(r => r.subject === target).map(normalizeEvidence).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  const exists = ir ? ir.nodes.some(n => n.id === target) : undefined;
  const latestFailure = [...records].filter(r=>r.status==='failed').sort((a,b)=>a.timestamp.localeCompare(b.timestamp)).at(-1);
  const latestPositive = [...records].filter(r=>r.status!=='failed' && (r.strength??evidenceStrength(r.status))>0).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)).at(-1);
  if (latestFailure && (!latestPositive || latestFailure.timestamp >= latestPositive.timestamp)) return { target, status:'failed', reason:'The newest material evidence contradicts or fails this guarantee.', evidence:records, strongest:'failed', strength:0 };
  const strongest = records.reduce<{status:EvidenceStatus;strength:EvidenceStrength}>((best,r)=>{
    const s=r.strength??evidenceStrength(r.status); return s>best.strength?{status:r.status,strength:s}:best;
  },{status:'unknown',strength:0});
  if (ir && !exists) return {target,status:'unknown',reason:'Evidence exists for an undeclared target. Declare the guarantee in StateTruss before treating evidence as proof.',evidence:records,strongest:strongest.status,strength:strongest.strength};
  if (strongest.strength >= 4) return {target,status:'verified',reason:'Verified evidence exists for this target.',evidence:records,strongest:strongest.status,strength:strongest.strength};
  if (strongest.strength >= 3) return {target,status:'supported',reason:'Test evidence supports this target, but no independent verification is recorded.',evidence:records,strongest:strongest.status,strength:strongest.strength};
  if (strongest.strength >= 2) return {target,status:'observed',reason:'Runtime observation exists, but it is not sufficient to establish a verified guarantee.',evidence:records,strongest:strongest.status,strength:strongest.strength};
  if (strongest.strength >= 1 || exists) return {target,status:'declared',reason:'The guarantee is declared but lacks runtime/test/verification evidence.',evidence:records,strongest:strongest.strength?strongest.status:'declared',strength:strongest.strength||1};
  return {target,status:'unknown',reason:'No declaration or supporting evidence is known for this target.',evidence:records,strongest:'unknown',strength:0};
}

export function runtimeAlignment(ir: ApplicationIR, observations: RuntimeObservationRecord[]): RuntimeAlignmentReport {
  const relevantKinds = new Set(['action','route','policy','invariant','resource','state','effect']);
  const declared = new Set(ir.nodes.filter(n => relevantKinds.has(n.kind)).map(n => n.id));
  const observed = new Set(observations.map(o => o.subject));
  const runtimeOnly = [...observed].filter(id => !declared.has(id)).sort();
  const unobserved = [...declared].filter(id => !observed.has(id)).sort();
  const matched = [...observed].filter(id => declared.has(id)).length;
  const coverage = declared.size ? matched / declared.size : 0;
  return { observedSubjects:observed.size, declaredSubjects:declared.size, matched, runtimeOnly, unobserved, failures:observations.filter(o=>o.status==='failed'||o.status==='denied'), coverage };
}

export function normalizeRuntimeObservation(input: Partial<RuntimeObservationRecord> & Pick<RuntimeObservationRecord,'kind'|'subject'|'status'>, defaults: { environment:string; source:string }): RuntimeObservationRecord {
  const timestamp = input.timestamp ?? new Date().toISOString();
  return {
    id: input.id ?? `obs_${randomUUID().slice(0,12)}`,
    kind: input.kind,
    subject: input.subject,
    status: input.status,
    timestamp,
    environment: input.environment ?? defaults.environment,
    source: input.source ?? defaults.source,
    ...(input.traceId ? { traceId:input.traceId } : {}),
    ...(input.parentId ? { parentId:input.parentId } : {}),
    ...(input.endedAt ? { endedAt:input.endedAt } : {}),
    ...(input.durationMs !== undefined ? { durationMs:input.durationMs } : {}),
    ...(input.actor ? { actor:input.actor } : {}),
    ...(input.inputHash ? { inputHash:input.inputHash } : {}),
    ...(input.outputHash ? { outputHash:input.outputHash } : {}),
    ...(input.metadata ? { metadata:input.metadata } : {})
  };
}

export function buildTrace(traceId:string, observations:RuntimeObservationRecord[]):RuntimeTraceRecord {
  const rows=observations.filter(o=>o.traceId===traceId).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  const first=rows[0]; if(!first) throw new Error(`No observations for trace: ${traceId}`);
  const failed=rows.some(o=>o.status==='failed'||o.status==='denied');
  const running=rows.at(-1)?.status==='started';
  return {
    id:traceId,
    name:String(first.metadata?.traceName ?? first.subject ?? traceId),
    environment:first.environment,
    source:first.source,
    startedAt:first.timestamp,
    ...(rows.map(o=>o.endedAt??o.timestamp).sort().at(-1) ? { endedAt: rows.map(o=>o.endedAt??o.timestamp).sort().at(-1)! } : {}),
    status:failed?'failed':running?'running':'passed',
    observationIds:rows.map(o=>o.id),
    ...(first.actor?{actor:first.actor}:{}),
    metadata:{observations:rows.length}
  };
}

export function evidenceToSemantic(ir:ApplicationIR, evidence:EvidenceRecord[]):ApplicationIR {
  const nodes=new Map(ir.nodes.map(n=>[n.id,n])); const edges=[...ir.edges]; const edgeKeys=new Set(edges.map(e=>`${e.from}|${e.relation}|${e.to}`));
  for(const record of evidence){
    const id=`evidence:${record.id}`;
    nodes.set(id,{id,kind:'evidence',label:record.claim,metadata:{status:record.status,source:record.source,timestamp:record.timestamp,strength:record.strength??evidenceStrength(record.status),subject:record.subject}});
    if(record.subject && nodes.has(record.subject)){
      const relation=record.status==='failed'?'contradicts':'supports'; const key=`${id}|${relation}|${record.subject}`;
      if(!edgeKeys.has(key)){edges.push({from:id,to:record.subject,relation,metadata:{status:record.status,source:record.source}});edgeKeys.add(key);}
    }
  }
  return {...ir,nodes:[...nodes.values()],edges,generatedAt:new Date().toISOString()};
}

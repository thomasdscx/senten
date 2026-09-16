import { createHash, randomUUID } from 'node:crypto';
import type {
  ApplicationIR,
  AssuranceCaseRecord,
  AssuranceClaim,
  AssuranceExchangeBundle,
  EvidenceRecord,
  GuaranteeResult
} from '../../core/src/index.js';
import { evaluateGuarantee } from '../../evidence-intelligence/src/index.js';

const CLAIM_KINDS = new Set(['invariant','policy','action','route','resource']);

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const rows = Object.entries(value as Record<string, unknown>)
      .filter(([,v]) => v !== undefined)
      .sort(([a],[b]) => a.localeCompare(b));
    return `{${rows.map(([k,v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Json(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function extractAssuranceClaims(ir: ApplicationIR, subjects?: string[]): AssuranceClaim[] {
  const filter = subjects?.length ? new Set(subjects) : undefined;
  return ir.nodes
    .filter(node => CLAIM_KINDS.has(node.kind) && (!filter || filter.has(node.id)))
    .map(node => ({
      id: `claim_${createHash('sha256').update(node.id).digest('hex').slice(0,16)}`,
      subject: node.id,
      kind: node.kind as AssuranceClaim['kind'],
      statement: claimStatement(node.kind, node.label ?? node.id),
      source: node.source ?? 'state-truss',
      metadata: sanitizeValue(node.metadata ?? {}) as Record<string, unknown>
    }))
    .sort((a,b) => a.subject.localeCompare(b.subject));
}

function claimStatement(kind: string, label: string): string {
  if (kind === 'invariant') return `Invariant ${label} remains true.`;
  if (kind === 'policy') return `Policy ${label} is enforced as declared.`;
  if (kind === 'route') return `Route ${label} behaves according to its declared contract.`;
  if (kind === 'action') return `Action ${label} behaves according to its declared contract.`;
  if (kind === 'resource') return `Resource ${label} preserves its declared constraints.`;
  return `${label} satisfies its declared assurance claim.`;
}

export function sanitizeValue(value: unknown, key = ''): unknown {
  const sensitive = /(secret|password|passwd|token|api[-_]?key|private[-_]?key|credential|authorization|cookie)/i;
  if (sensitive.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(v => sanitizeValue(v));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v]) => [k, sanitizeValue(v,k)]));
  }
  return value;
}

export function sanitizeEvidence(record: EvidenceRecord): EvidenceRecord {
  return {
    ...record,
    ...(record.provenance ? { provenance: sanitizeValue(record.provenance) as Record<string,unknown> } : {}),
    ...(record.metadata ? { metadata: sanitizeValue(record.metadata) as Record<string,unknown> } : {})
  };
}

export function createAssuranceExchange(input: {
  sentenVersion: string;
  ir: ApplicationIR;
  evidence: EvidenceRecord[];
  subjects?: string[];
  environment?: string;
}): AssuranceExchangeBundle {
  const claims = extractAssuranceClaims(input.ir,input.subjects);
  const claimSubjects = new Set(claims.map(c => c.subject));
  const evidence = input.evidence.filter(e => e.subject && claimSubjects.has(e.subject)).map(sanitizeEvidence);
  const stateTrussDigest = sha256Json(input.ir);
  const generatedAt = new Date().toISOString();
  const base = {
    schemaVersion: '0.1' as const,
    kind: 'senten-assurance-exchange' as const,
    id: `asx_${randomUUID().slice(0,12)}`,
    generatedAt,
    sentenVersion: input.sentenVersion,
    application: input.ir.application,
    stateTrussDigest,
    claims,
    evidence,
    provenance: {
      producer: 'Senten' as const,
      evidencePolicy: 'evidence-before-ai' as const,
      unknownIsPass: false as const,
      ...(input.environment ? { environment: input.environment } : {})
    }
  };
  return { ...base, digest: sha256Json(base) };
}

export function validateAssuranceExchange(bundle: AssuranceExchangeBundle): string[] {
  const errors: string[] = [];
  if (bundle.schemaVersion !== '0.1') errors.push(`Unsupported assurance schema: ${bundle.schemaVersion}`);
  if (bundle.kind !== 'senten-assurance-exchange') errors.push('Invalid assurance bundle kind.');
  const { digest, ...base } = bundle;
  const actual = sha256Json(base);
  if (digest !== actual) errors.push('Assurance bundle digest mismatch.');
  const ids = new Set<string>();
  for (const claim of bundle.claims) {
    if (ids.has(claim.id)) errors.push(`Duplicate claim id: ${claim.id}`);
    ids.add(claim.id);
    if (!claim.subject) errors.push(`Claim ${claim.id} has no subject.`);
  }
  return errors;
}

export function createAssuranceCase(name: string, claimIds: string[], actor = 'human:local'): AssuranceCaseRecord {
  return {
    id: `case_${randomUUID().slice(0,12)}`,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: actor,
    claimIds: [...new Set(claimIds)],
    status: 'incomplete',
    evidenceIds: [],
    verificationResultIds: []
  };
}

export function evaluateAssuranceCase(record: AssuranceCaseRecord, claims: AssuranceClaim[], evidence: EvidenceRecord[], ir: ApplicationIR): AssuranceCaseRecord {
  const claimMap = new Map(claims.map(c => [c.id,c]));
  const results: GuaranteeResult[] = [];
  const evidenceIds = new Set<string>();
  for (const id of record.claimIds) {
    const claim = claimMap.get(id);
    if (!claim) continue;
    const result = evaluateGuarantee(claim.subject,evidence,ir);
    results.push(result);
    for (const ev of result.evidence) evidenceIds.add(ev.id);
  }
  let status: AssuranceCaseRecord['status'] = 'incomplete';
  if (results.some(r => r.status === 'failed')) status = 'failed';
  else if (results.length === record.claimIds.length && results.length > 0 && results.every(r => r.status === 'verified')) status = 'verified';
  else if (results.length > 0 && results.every(r => ['verified','supported'].includes(r.status))) status = 'supported';
  return { ...record, updatedAt: new Date().toISOString(), status, evidenceIds:[...evidenceIds] };
}

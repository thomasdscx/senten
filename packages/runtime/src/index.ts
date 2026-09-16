import { randomUUID } from 'node:crypto';
import type { Contract } from '../../contracts/src/index.js';
import type { EvidenceRecord, RuntimeObservationRecord } from '../../core/src/index.js';
import type { PolicyContext } from '../../security/src/index.js';
import { PolicyEngine } from '../../security/src/index.js';

export interface ExecutionContext {
  actor?: Record<string, unknown>;
  environment: string;
  services?: Record<string, unknown>;
  traceId?: string;
  source?: string;
}

export interface Invariant<T> {
  id: string;
  check(value: T, context: ExecutionContext): boolean | Promise<boolean>;
}

export interface ActionDefinition<I, O> {
  id: string;
  input: Contract<I>;
  policy?: string;
  effects?: string[];
  invariants?: Invariant<O>[];
  audit?: boolean;
  handler(input: I, context: ExecutionContext): Promise<O> | O;
}

export interface ActionResult<O> {
  value: O;
  evidence: EvidenceRecord[];
  observations: RuntimeObservationRecord[];
}

export interface RuntimeSink { record(observation: RuntimeObservationRecord): void | Promise<void>; }
export interface EvidenceSink { record(evidence: EvidenceRecord): void | Promise<void>; }
export interface ExecutionSinks { runtime?: RuntimeSink; evidence?: EvidenceSink; }

export function defineInvariant<T>(id: string, check: Invariant<T>['check']): Invariant<T> { return { id, check }; }
export function defineAction<I, O>(definition: ActionDefinition<I, O>): ActionDefinition<I, O> { return definition; }

export class ExecutionEngine {
  constructor(private readonly policyEngine = new PolicyEngine(), private readonly sinks: ExecutionSinks = {}) {}

  async execute<I, O>(action: ActionDefinition<I, O>, rawInput: unknown, context: ExecutionContext): Promise<ActionResult<O>> {
    const evidence: EvidenceRecord[] = [];
    const observations: RuntimeObservationRecord[] = [];
    const traceId = context.traceId ?? `trace_${randomUUID().slice(0,12)}`;
    const source = context.source ?? 'senten.runtime';
    const startedAt = new Date().toISOString();
    const started = observation('action', `action:${action.id}`, 'started', context.environment, source, traceId, startedAt);
    await this.emitObservation(started, observations);

    try {
      const input = action.input.parse(rawInput);
      await this.emitEvidence(record(`${action.id}:input:${randomUUID().slice(0,8)}`, `Input contract ${action.input.name}`, 'tested', `action:${action.id}`, source, traceId, context.environment), evidence);

      if (action.policy) {
        const policyContext: PolicyContext = { environment: context.environment, ...(context.actor ? { actor: context.actor } : {}) };
        const decision = await this.policyEngine.evaluate(action.policy, policyContext);
        const policySubject = action.policy.startsWith('policy:') ? action.policy : `policy:${action.policy}`;
        const policyObservation = observation('policy', policySubject, decision.effect === 'allow' ? 'passed' : decision.effect === 'deny' ? 'denied' : 'unknown', context.environment, source, traceId);
        await this.emitObservation(policyObservation, observations);
        await this.emitEvidence(record(`${action.id}:policy:${randomUUID().slice(0,8)}`, `Policy ${action.policy}`, decision.effect === 'allow' ? 'observed' : decision.effect === 'deny' ? 'failed' : 'unknown', policySubject, source, traceId, context.environment), evidence);
        if (decision.effect !== 'allow') throw new Error(`Policy ${action.policy} denied or unknown: ${decision.reason ?? decision.effect}`);
      }

      for (const effect of action.effects ?? []) {
        const effectSubject = effect.startsWith('effect:') ? effect : `effect:${effect}`;
        await this.emitObservation(observation('effect', effectSubject, 'observed', context.environment, source, traceId), observations);
      }

      const value = await action.handler(input, context);

      for (const invariant of action.invariants ?? []) {
        const ok = await invariant.check(value, context);
        const subject = invariant.id.startsWith('invariant:') ? invariant.id : `invariant:${invariant.id}`;
        await this.emitObservation(observation('invariant', subject, ok ? 'passed' : 'failed', context.environment, source, traceId), observations);
        await this.emitEvidence(record(`${action.id}:invariant:${randomUUID().slice(0,8)}`, `Invariant ${invariant.id}`, ok ? 'tested' : 'failed', subject, source, traceId, context.environment), evidence);
        if (!ok) throw new Error(`Invariant failed: ${invariant.id}`);
      }

      if (action.audit) await this.emitEvidence(record(`${action.id}:audit:${randomUUID().slice(0,8)}`, `Audit requirement for ${action.id}`, 'observed', `action:${action.id}`, source, traceId, context.environment), evidence);
      const ended = observation('action', `action:${action.id}`, 'passed', context.environment, source, traceId, undefined, startedAt);
      await this.emitObservation(ended, observations);
      return { value, evidence, observations };
    } catch (error) {
      const failed = observation('action', `action:${action.id}`, 'failed', context.environment, source, traceId, undefined, startedAt, { error: error instanceof Error ? error.message : String(error) });
      await this.emitObservation(failed, observations);
      throw error;
    }
  }

  private async emitObservation(value:RuntimeObservationRecord, target:RuntimeObservationRecord[]):Promise<void> { target.push(value); await this.sinks.runtime?.record(value); }
  private async emitEvidence(value:EvidenceRecord, target:EvidenceRecord[]):Promise<void> { target.push(value); await this.sinks.evidence?.record(value); }
}

function record(id: string, claim: string, status: EvidenceRecord['status'], subject:string, source:string, traceId:string, environment:string): EvidenceRecord {
  const strength = status === 'verified' ? 4 : status === 'tested' ? 3 : status === 'observed' ? 2 : status === 'declared' ? 1 : 0;
  return { id, claim, subject, source, status, strength, evidenceType: status === 'tested' ? 'test' : 'runtime', traceId, environment, timestamp: new Date().toISOString() };
}

function observation(kind:RuntimeObservationRecord['kind'],subject:string,status:RuntimeObservationRecord['status'],environment:string,source:string,traceId:string,timestamp?:string,startedAt?:string,metadata?:Record<string,unknown>):RuntimeObservationRecord {
  const now=timestamp??new Date().toISOString(); const endedAt=startedAt?now:undefined; const durationMs=startedAt?Math.max(0,new Date(now).getTime()-new Date(startedAt).getTime()):undefined;
  return {id:`obs_${randomUUID().slice(0,12)}`,traceId,kind,subject,status,timestamp:startedAt??now,...(endedAt?{endedAt}:{}),...(durationMs!==undefined?{durationMs}:{}),environment,source,...(metadata?{metadata}:{})};
}

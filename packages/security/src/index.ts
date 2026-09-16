import type { PolicyDecision } from '../../core/src/index.js';

export interface PolicyContext {
  actor?: Record<string, unknown>;
  resource?: Record<string, unknown>;
  purpose?: string;
  environment?: string;
  [key: string]: unknown;
}

export interface Policy {
  id: string;
  evaluate(context: PolicyContext): PolicyDecision | Promise<PolicyDecision>;
}

export function definePolicy(id: string, evaluator: Policy['evaluate']): Policy {
  return { id, evaluate: evaluator };
}

export class PolicyEngine {
  private readonly policies = new Map<string, Policy>();
  register(policy: Policy): this { this.policies.set(policy.id, policy); return this; }

  async evaluate(id: string, context: PolicyContext): Promise<PolicyDecision> {
    const policy = this.policies.get(id);
    if (!policy) return { policyId: id, effect: 'unknown', reason: 'Policy is not registered.' };
    return policy.evaluate(context);
  }

  async require(id: string, context: PolicyContext): Promise<void> {
    const decision = await this.evaluate(id, context);
    if (decision.effect !== 'allow') {
      throw new Error(`Policy ${id} denied or unknown: ${decision.reason ?? decision.effect}`);
    }
  }
}

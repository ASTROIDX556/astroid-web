/** The API response describes a preview, not an authorization to sign. */
export type PolicyRuleKind = 'daily_limit' | 'recipient_whitelist' | 'multi_sig' | 'custom';
export type PolicyRuleStatus = 'pass' | 'fail' | 'warning';
export type PolicySimulationStatus = 'pass' | 'fail';

export interface PolicyRuleCondition {
  label: string;
  expected: string;
  actual: string;
  matched: boolean;
}

export interface PolicyRuleEvaluation {
  id: string;
  kind: PolicyRuleKind;
  name: string;
  description?: string;
  status: PolicyRuleStatus;
  conditions: PolicyRuleCondition[];
  reason?: string;
}

export interface PolicySimulationResponse {
  simulationId: string;
  transactionId?: string;
  evaluatedAt: string;
  status: PolicySimulationStatus;
  rules: PolicyRuleEvaluation[];
}

import { z } from 'zod';
import type { Policy } from '@/types/domain';

export const proposedTransactionSchema = z.object({
  amount: z.number().finite().positive('Enter an amount greater than zero.'),
  recipient: z.string().trim().regex(/^G[A-Z2-7]{55}$/, 'Enter a valid 56-character Stellar G-address.'),
  department: z.string().trim().min(1, 'Select a department.'),
  asset: z.enum(['XLM', 'USDC', 'EURC']),
});

export type ProposedTransaction = z.infer<typeof proposedTransactionSchema>;

export interface PolicyEvaluationRule {
  id: string;
  label: string;
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
}

export interface PolicyEvaluationResponse {
  passed: boolean;
  rules: PolicyEvaluationRule[];
  evaluatedAt: string;
  /** Preview only: results do not authorize, sign, or broadcast a transaction. */
  simulated: true;
}

export interface PolicySimulationConfig {
  maxTransactionAmount?: number;
  dailyLimit?: number;
  dailySpent?: number;
  departmentBudget?: number;
  departmentSpent?: number;
  allowedRecipients?: string[];
}

function policyNumeric(config: Policy['configuration'], key: string): number | undefined {
  const raw = config[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

/** Extract only representable guardrails; unsupported rules are never silently approved. */
export function configFromPolicies(policies: Policy[]): PolicySimulationConfig {
  const config: PolicySimulationConfig = {};
  for (const policy of policies) {
    if (!policy.enabled) continue;
    const settings = policy.configuration;
    switch (policy.type) {
      case 'max_spend':
        config.maxTransactionAmount = policyNumeric(settings, 'maxAmount');
        break;
      case 'daily_budget':
        config.dailyLimit = policyNumeric(settings, 'limit');
        config.dailySpent = policyNumeric(settings, 'spent') ?? 0;
        break;
      case 'weekly_budget':
      case 'monthly_budget':
        config.departmentBudget = policyNumeric(settings, 'limit');
        config.departmentSpent = policyNumeric(settings, 'spent') ?? 0;
        break;
      case 'allowed_recipients': {
        const addresses = settings.recipients;
        if (Array.isArray(addresses)) config.allowedRecipients = addresses.filter((address): address is string => typeof address === 'string');
        break;
      }
      default:
        break;
    }
  }
  return config;
}

export function evaluateProposedTransaction(
  transaction: ProposedTransaction,
  config: PolicySimulationConfig,
): PolicyEvaluationResponse {
  const validated = proposedTransactionSchema.parse(transaction);
  const rules: PolicyEvaluationRule[] = [];
  const check = (id: string, label: string, passed: boolean, message: string, expected?: string, actual?: string) => {
    rules.push({ id, label, passed, message, expected, actual });
  };
  if (config.maxTransactionAmount !== undefined) {
    check('max-transaction', 'Transaction ceiling', validated.amount <= config.maxTransactionAmount,
      validated.amount <= config.maxTransactionAmount ? 'Amount is within the transaction cap.' : 'Amount exceeds the maximum allowed transaction.',
      String(config.maxTransactionAmount), String(validated.amount));
  }
  if (config.dailyLimit !== undefined) {
    const projected = (config.dailySpent ?? 0) + validated.amount;
    check('daily-limit', 'Daily velocity limit', projected <= config.dailyLimit,
      projected <= config.dailyLimit ? 'Projected daily spend is within the limit.' : 'Projected daily spend exceeds the limit.',
      String(config.dailyLimit), String(projected));
  }
  if (config.departmentBudget !== undefined) {
    const projected = (config.departmentSpent ?? 0) + validated.amount;
    check('department-budget', `${validated.department} department budget`, projected <= config.departmentBudget,
      projected <= config.departmentBudget ? 'Department budget has room for this transaction.' : 'Department budget would be exceeded.',
      String(config.departmentBudget), String(projected));
  }
  if (config.allowedRecipients !== undefined) {
    const approved = config.allowedRecipients.includes(validated.recipient);
    check('recipient-whitelist', 'Recipient allow-list', approved,
      approved ? 'Recipient is approved.' : 'Recipient is not on the approved list.',
      'Whitelisted Stellar address', validated.recipient);
  }
  // Fail closed: an empty or unconfigured policy set is not approval.
  if (rules.length === 0) check('no-policies', 'Active policy configuration', false,
    'No supported spending rules are configured. Review policy setup before execution.');
  return { passed: rules.every((rule) => rule.passed), rules, evaluatedAt: new Date().toISOString(), simulated: true };
}

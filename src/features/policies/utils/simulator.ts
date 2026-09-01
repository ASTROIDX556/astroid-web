import { type PolicyRule } from '../rulesSchema';

export interface SandboxTransaction {
  recipientAddress: string;
  amount: string;
  asset: string;
}

export interface RuleEvaluationResult {
  rule: PolicyRule;
  passed: boolean;
  message: string;
}

export interface SandboxSimulationResult {
  passed: boolean;
  results: RuleEvaluationResult[];
  summary: string;
}

function evaluateAmount(amountStr: string, operator: string, thresholdStr: string): boolean {
  const amount = parseFloat(amountStr);
  const threshold = parseFloat(thresholdStr);
  if (isNaN(amount) || isNaN(threshold)) return false;

  switch (operator) {
    case 'equals':
      return amount === threshold;
    case 'greater_than':
      return amount > threshold;
    case 'less_than':
      return amount < threshold;
    default:
      return false;
  }
}

function evaluateAsset(asset: string, operator: string, expected: string): boolean {
  switch (operator) {
    case 'equals':
      return asset.toUpperCase() === expected.toUpperCase();
    case 'contains':
      return asset.toUpperCase().includes(expected.toUpperCase());
    default:
      return false;
  }
}

function evaluateRecipient(recipient: string, operator: string, expected: string): boolean {
  switch (operator) {
    case 'equals':
      return recipient === expected;
    case 'contains':
      return recipient.includes(expected);
    default:
      return false;
  }
}

function evaluateWhitelist(recipient: string, whitelistStr: string): boolean {
  const addresses = whitelistStr
    .split(',')
    .map((addr) => addr.trim())
    .filter(Boolean);
  return addresses.includes(recipient);
}

function formatAction(action: string): string {
  switch (action) {
    case 'require_approval':
      return 'requires approval';
    case 'block':
      return 'blocks transaction';
    case 'flag':
      return 'flags for review';
    case 'allow':
      return 'allows transaction';
    default:
      return action;
  }
}

export function evaluateRule(
  transaction: SandboxTransaction,
  rule: PolicyRule,
): RuleEvaluationResult {
  const { field, operator, value, action } = rule;
  let violated = false;

  switch (field) {
    case 'Transaction Amount':
      violated = !evaluateAmount(transaction.amount, operator, value);
      break;
    case 'Asset Identifier':
      violated = !evaluateAsset(transaction.asset, operator, value);
      break;
    case 'Destination Target':
      violated = !evaluateRecipient(transaction.recipientAddress, operator, value);
      break;
    case 'Approved Account Whitelist':
      violated = !evaluateWhitelist(transaction.recipientAddress, value);
      break;
    default:
      violated = false;
  }

  const fieldLabel = field.toLowerCase();
  const message = violated
    ? `Transaction ${fieldLabel} violates rule: ${field} ${operator} ${value} → ${formatAction(action)}`
    : `Transaction ${fieldLabel} passes: ${field} ${operator} ${value}`;

  return { rule, passed: !violated, message };
}

export function simulateTransaction(
  transaction: SandboxTransaction,
  rules: PolicyRule[],
): SandboxSimulationResult {
  const results = rules.map((rule) => evaluateRule(transaction, rule));
  const passed = results.every((r) => r.passed);
  const violationCount = results.filter((r) => !r.passed).length;

  const summary = passed
    ? 'All rules passed. Transaction is compliant.'
    : `${violationCount} rule violation${violationCount > 1 ? 's' : ''} detected.`;

  return { passed, results, summary };
}

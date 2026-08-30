import { z } from 'zod';

export const ruleFieldOptions = [
  'Transaction Amount',
  'Asset Identifier',
  'Destination Target',
  'Approved Account Whitelist',
] as const;

export const ruleOperatorOptions = [
  'equals',
  'greater_than',
  'less_than',
  'contains',
  'in_whitelist',
] as const;

export const ruleActionOptions = ['allow', 'require_approval', 'block', 'flag'] as const;

export type RuleField = (typeof ruleFieldOptions)[number];
export type RuleOperator = (typeof ruleOperatorOptions)[number];
export type RuleAction = (typeof ruleActionOptions)[number];

export const ruleSchema = z.object({
  field: z.enum(ruleFieldOptions),
  operator: z.enum(ruleOperatorOptions),
  value: z.string().min(1, 'Value is required'),
  action: z.enum(ruleActionOptions),
});

export type PolicyRule = z.infer<typeof ruleSchema>;

export interface PolicySimulationInput {
  amount: string;
  assetCode: string;
  destinationAddress: string;
  agentId: string;
}

export interface PolicyRuleEvaluation {
  passed: boolean;
  reason: string;
}

export const defaultRule: PolicyRule = {
  field: 'Transaction Amount',
  operator: 'greater_than',
  value: '1000',
  action: 'require_approval',
};

export const defaultPolicyRules: PolicyRule[] = [
  {
    field: 'Transaction Amount',
    operator: 'greater_than',
    value: '2500',
    action: 'require_approval',
  },
  {
    field: 'Approved Account Whitelist',
    operator: 'in_whitelist',
    value: 'G...A1, G...B2',
    action: 'allow',
  },
];

export function validateRule(input: Partial<PolicyRule>) {
  return ruleSchema.safeParse(input);
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function evaluateRuleAgainstTransaction(
  rule: PolicyRule,
  transaction: PolicySimulationInput,
): PolicyRuleEvaluation {
  const cleanedValue = normalizeWhitespace(rule.value);
  const { amount, assetCode, destinationAddress } = transaction;

  switch (rule.field) {
    case 'Transaction Amount': {
      const parsedAmount = Number(amount);
      const target = Number(cleanedValue);
      const isNumeric = Number.isFinite(parsedAmount) && Number.isFinite(target);

      if (!isNumeric) {
        return {
          passed: false,
          reason: `Unable to compare ${amount} to the configured rule value ${cleanedValue}.`,
        };
      }

      if (rule.operator === 'greater_than') {
        return {
          passed: parsedAmount > target,
          reason: `${parsedAmount} is ${parsedAmount > target ? 'above' : 'not above'} the threshold of ${target}.`,
        };
      }
      if (rule.operator === 'less_than') {
        return {
          passed: parsedAmount < target,
          reason: `${parsedAmount} is ${parsedAmount < target ? 'below' : 'not below'} the threshold of ${target}.`,
        };
      }
      return {
        passed: parsedAmount === target,
        reason: `${parsedAmount} ${parsedAmount === target ? 'matches' : 'does not match'} the threshold of ${target}.`,
      };
    }

    case 'Asset Identifier': {
      const transactionAsset = normalizeWhitespace(assetCode).toUpperCase();
      const ruleValue = cleanedValue.toUpperCase();

      if (rule.operator === 'contains') {
        return {
          passed: transactionAsset.includes(ruleValue),
          reason: `${transactionAsset} ${transactionAsset.includes(ruleValue) ? 'contains' : 'does not contain'} ${ruleValue}.`,
        };
      }

      return {
        passed: transactionAsset === ruleValue,
        reason: `${transactionAsset} ${transactionAsset === ruleValue ? 'matches' : 'does not match'} ${ruleValue}.`,
      };
    }

    case 'Destination Target': {
      const destination = normalizeWhitespace(destinationAddress);
      const targetValue = cleanedValue;

      if (rule.operator === 'contains') {
        return {
          passed: destination.includes(targetValue),
          reason: `${destination} ${destination.includes(targetValue) ? 'includes' : 'does not include'} ${targetValue}.`,
        };
      }

      return {
        passed: destination === targetValue,
        reason: `${destination} ${destination === targetValue ? 'matches' : 'does not match'} ${targetValue}.`,
      };
    }

    case 'Approved Account Whitelist': {
      const destinations = cleanedValue
        .split(',')
        .map((entry) => normalizeWhitespace(entry))
        .filter(Boolean);

      const destination = normalizeWhitespace(destinationAddress);
      const includesTarget = destinations.includes(destination) || destinations.some((entry) => entry.toLowerCase() === destination.toLowerCase());

      if (rule.operator === 'in_whitelist') {
        return {
          passed: includesTarget,
          reason: `Destination ${destination} ${includesTarget ? 'is approved' : 'is not in the whitelist'} (${destinations.join(', ') || 'empty list'}).`,
        };
      }

      if (rule.operator === 'contains') {
        return {
          passed: destinations.some((entry) => destination.includes(entry)),
          reason: `${destination} ${destinations.some((entry) => destination.includes(entry)) ? 'matches' : 'does not match'} an approved destination entry.`,
        };
      }

      return {
        passed: destination === cleanedValue,
        reason: `${destination} ${destination === cleanedValue ? 'matches' : 'does not match'} the configured account target.`,
      };
    }

    default:
      return {
        passed: true,
        reason: 'No rule logic defined for this field.',
      };
  }
}

export function evaluatePolicyRules(rules: PolicyRule[], transaction: PolicySimulationInput) {
  const matches = new Map<number, PolicyRuleEvaluation>();
  const failingRules: Array<{ index: number; rule: PolicyRule; evaluation: PolicyRuleEvaluation }> = [];

  rules.forEach((rule, index) => {
    const evaluation = evaluateRuleAgainstTransaction(rule, transaction);
    matches.set(index, evaluation);

    if (!evaluation.passed) {
      failingRules.push({ index, rule, evaluation });
    }
  });

  return {
    passed: failingRules.length === 0,
    matches,
    failingRules,
  };
}

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

const fieldOperatorMap: Record<RuleField, readonly RuleOperator[]> = {
  'Transaction Amount': ['equals', 'greater_than', 'less_than'],
  'Asset Identifier': ['equals', 'contains', 'in_whitelist'],
  'Destination Target': ['equals', 'contains', 'in_whitelist'],
  'Approved Account Whitelist': ['equals', 'contains', 'in_whitelist'],
};

export function getOperatorsForField(field: RuleField): readonly RuleOperator[] {
  return fieldOperatorMap[field];
}

// Stellar public key format: uppercase G followed by 55 base32 chars.
// Excludes 0, 1, I, O to avoid ambiguity.
const stellarPublicKeyRegex = /^G[A-HJ-NP-Z2-7]{55}$/;

const assetIdentifierRegex = /^(?:XLM|[A-Za-z0-9]{1,12}:G[A-HJ-NP-Z2-7]{55})$/;

export const ruleSchema = z.object({
  field: z.enum(ruleFieldOptions),
  operator: z.enum(ruleOperatorOptions),
  value: z.string().min(1, 'Value is required'),
  action: z.enum(ruleActionOptions),
}).superRefine((val, ctx) => {
  const allowedOperators = fieldOperatorMap[val.field];
  if (!allowedOperators.includes(val.operator)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['operator'],
      message: `Operator "${val.operator}" is not valid for field "${val.field}"`,
    });
  }

  if (val.field === 'Transaction Amount') {
    if (!/^\d*\.?\d+$/.test(val.value) || Number(val.value) < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Transaction amount must be a non-negative number',
      });
    }
  }

  if (val.field === 'Asset Identifier') {
    if (!assetIdentifierRegex.test(val.value.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Asset identifier must be "XLM" or "CODE:ISSUER" (e.g. "USDC:GA5Z...")',
      });
    }
  }

  if (val.field === 'Destination Target' || val.field === 'Approved Account Whitelist') {
    const addresses = val.field === 'Approved Account Whitelist' ? val.value.split(',').map(s => s.trim()) : [val.value];
    for (let i = 0; i < addresses.length; i++) {
      if (addresses[i].length === 0 || !stellarPublicKeyRegex.test(addresses[i])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: `Invalid Stellar address${addresses.length > 1 ? ` at position ${i + 1}` : ''}`,
        });
        break;
      }
    }
  }
});

export type PolicyRule = z.infer<typeof ruleSchema>;

export const defaultRule: PolicyRule = {
  field: 'Transaction Amount',
  operator: 'greater_than',
  value: '1000',
  action: 'require_approval',
};

export function validateRule(input: Partial<PolicyRule>) {
  return ruleSchema.safeParse(input);
}

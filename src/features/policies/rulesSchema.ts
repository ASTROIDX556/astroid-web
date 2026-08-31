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
}).superRefine((val, ctx) => {
  if (val.field === 'Transaction Amount') {
    if (!/^\d*\.?\d+$/.test(val.value) || Number(val.value) < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Transaction amount must be a non-negative number',
      });
    }
  }
  if (val.field === 'Destination Target' || val.field === 'Approved Account Whitelist') {
    const addresses = val.field === 'Approved Account Whitelist' ? val.value.split(',').map(s => s.trim()) : [val.value];
    const stellarRegex = /^G[1-9A-HJ-NP-Za-km-z]{55}$/;
    for (let i = 0; i < addresses.length; i++) {
      if (!stellarRegex.test(addresses[i])) {
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

export const policySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  rules: z.array(ruleSchema).min(1, 'At least one rule is required'),
});

export type Policy = z.infer<typeof policySchema>;
export type PolicyInput = z.input<typeof policySchema>;

export const defaultPolicy: Policy = {
  name: '',
  description: '',
  enabled: true,
  rules: [defaultRule],
};

export function validatePolicy(input: Partial<Policy>) {
  return policySchema.safeParse(input);
}

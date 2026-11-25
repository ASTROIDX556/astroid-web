import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Rule vocabulary                                                             */
/* -------------------------------------------------------------------------- */

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

export const ruleActionOptions = [
  'allow',
  'require_approval',
  'block',
  'flag',
] as const;

export const assetCodeOptions = ['XLM', 'USDC', 'EURC', 'ASTRO', 'BTC', 'ETH'] as const;

export type RuleField = (typeof ruleFieldOptions)[number];
export type RuleOperator = (typeof ruleOperatorOptions)[number];
export type RuleAction = (typeof ruleActionOptions)[number];
export type AssetCodeOption = (typeof assetCodeOptions)[number];

/** Stellar-style asset codes: 1–12 alphanumeric characters. */
export const ASSET_CODE_PATTERN = /^[A-Z0-9]{1,12}$/;

const NUMERIC_OPERATORS: readonly RuleOperator[] = [
  'equals',
  'greater_than',
  'less_than',
];
const TEXT_OPERATORS: readonly RuleOperator[] = ['equals', 'contains'];

/** Parse a rule threshold; `null` when the value is not a finite number. */
export function parseThresholdValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** True when `value` is a syntactically valid Stellar asset code. */
export function isValidAssetCode(value: string): boolean {
  return ASSET_CODE_PATTERN.test(value.trim().toUpperCase());
}

/** Split a comma/newline separated whitelist value into trimmed entries. */
export function parseWhitelistEntries(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/* -------------------------------------------------------------------------- */
/* Schema                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Runtime validation for a single policy rule definition.
 *
 * Beyond shape validation this enforces cross-field rules the UI relies on:
 * numeric thresholds for amount conditions must be positive and finite
 * (negative limits are rejected), asset conditions must use valid asset codes,
 * and whitelist conditions must carry at least one entry. `id` and `enabled`
 * are optional so a draft rule (pre-persistence) validates too.
 */
export const policyRuleSchema = z
  .object({
    id: z.string().min(1).optional(),
    field: z.enum(ruleFieldOptions),
    operator: z.enum(ruleOperatorOptions),
    value: z.string().trim().min(1, 'Value is required'),
    action: z.enum(ruleActionOptions),
    enabled: z.boolean().optional(),
  })
  .superRefine((rule, ctx) => {
    if (rule.field === 'Transaction Amount') {
      if (!NUMERIC_OPERATORS.includes(rule.operator)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['operator'],
          message: 'Amount rules only support equals, greater than, or less than.',
        });
        return;
      }
      const threshold = parseThresholdValue(rule.value);
      if (threshold === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Amount threshold must be a finite number.',
        });
      } else if (threshold <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Amount threshold must be greater than zero.',
        });
      }
      return;
    }

    if (rule.field === 'Asset Identifier') {
      if (!TEXT_OPERATORS.includes(rule.operator)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['operator'],
          message: 'Asset rules only support equals or contains.',
        });
      }
      if (!isValidAssetCode(rule.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Asset code must be 1–12 alphanumeric characters (e.g. USDC).',
        });
      }
      return;
    }

    if (rule.field === 'Destination Target') {
      if (!TEXT_OPERATORS.includes(rule.operator)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['operator'],
          message: 'Destination rules only support equals or contains.',
        });
      }
      return;
    }

    if (rule.field === 'Approved Account Whitelist') {
      if (!TEXT_OPERATORS.includes(rule.operator) && rule.operator !== 'in_whitelist') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['operator'],
          message: 'Whitelist rules only support equals, contains, or in_whitelist.',
        });
      }
      if (parseWhitelistEntries(rule.value).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Whitelist must contain at least one account.',
        });
      }
      return;
    }

    if (rule.operator === 'in_whitelist') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['operator'],
        message: 'The in_whitelist operator is only valid for whitelist rules.',
      });
    }
  });

/** Alias kept for existing imports. */
export const ruleSchema = policyRuleSchema;

/** A validated policy rule (output of {@link policyRuleSchema}). */
export type PolicyRule = z.infer<typeof policyRuleSchema>;

/** A rule as authored in the builder, before Zod applies defaults. */
export type PolicyRuleDraft = z.input<typeof policyRuleSchema>;

export const defaultRule: PolicyRule = {
  field: 'Transaction Amount',
  operator: 'greater_than',
  value: '1000',
  action: 'require_approval',
};

/** Validate a (possibly partial) rule; never throws. */
export function validateRule(input: Partial<PolicyRuleDraft>) {
  return policyRuleSchema.safeParse(input);
}

/** Validate a list of rules, returning the valid ones plus indexed errors. */
export function validateRules(inputs: readonly PolicyRuleDraft[]): {
  rules: PolicyRule[];
  errors: { index: number; message: string }[];
} {
  const rules: PolicyRule[] = [];
  const errors: { index: number; message: string }[] = [];
  inputs.forEach((input, index) => {
    const result = policyRuleSchema.safeParse(input);
    if (result.success) {
      rules.push(result.data);
    } else {
      errors.push({
        index,
        message: result.error.issues[0]?.message ?? 'Invalid rule.',
      });
    }
  });
  return { rules, errors };
}

/* -------------------------------------------------------------------------- */
/* Simulation                                                                  */
/* -------------------------------------------------------------------------- */

export interface SimulatedTransaction {
  amount: number;
  asset: string;
  /** Destination account or vendor the payment targets. */
  destination?: string;
}

export type SimulationOutcome = 'allow' | 'flag' | 'require_approval' | 'block';

export interface RuleEvaluation {
  ruleId: string;
  index: number;
  field: RuleField;
  operator: RuleOperator;
  action: RuleAction;
  /** True when the transaction satisfies the rule condition. */
  matched: boolean;
  message: string;
}

export interface InvalidRuleReport {
  index: number;
  message: string;
}

export interface RuleSimulationResult {
  /** Most restrictive action across every matched rule. */
  outcome: SimulationOutcome;
  /** Matched rules whose action is not `allow`, i.e. policy violations. */
  violations: RuleEvaluation[];
  /** Matched allow-rules (whitelists, explicit permits). */
  permits: RuleEvaluation[];
  /** Every evaluated rule, matched or not. */
  evaluations: RuleEvaluation[];
  /** Rules that failed validation and were skipped. */
  invalidRules: InvalidRuleReport[];
  /** True when nothing blocked or escalated the transaction. */
  passed: boolean;
}

const ACTION_SEVERITY: Record<RuleAction, number> = {
  allow: 0,
  flag: 1,
  require_approval: 2,
  block: 3,
};

const OUTCOME_BY_ACTION: Record<RuleAction, SimulationOutcome> = {
  allow: 'allow',
  flag: 'flag',
  require_approval: 'require_approval',
  block: 'block',
};

function ruleIdFor(rule: PolicyRule, index: number): string {
  return rule.id ?? `rule-${index}`;
}

function matchesNumeric(
  operator: RuleOperator,
  actual: number,
  threshold: number,
): boolean {
  switch (operator) {
    case 'greater_than':
      // Boundary is exclusive: a transaction at exactly the threshold passes.
      return actual > threshold;
    case 'less_than':
      // Boundary is exclusive: a transaction at exactly the threshold passes.
      return actual < threshold;
    case 'equals':
      return actual === threshold;
    default:
      return false;
  }
}

function matchesText(
  operator: RuleOperator,
  actual: string,
  expected: string,
): boolean {
  const left = actual.trim().toLowerCase();
  const right = expected.trim().toLowerCase();
  if (operator === 'equals') return left === right;
  if (operator === 'contains') return right.length > 0 && left.includes(right);
  return false;
}

/**
 * Evaluate one rule against one transaction.
 *
 * Invalid rules are reported as `{ valid: false }` rather than throwing so a
 * malformed rule in a large set can never break simulation of the others.
 */
export function evaluateRule(
  rule: PolicyRuleDraft,
  transaction: SimulatedTransaction,
  index = 0,
):
  | { valid: true; evaluation: RuleEvaluation }
  | { valid: false; report: InvalidRuleReport } {
  const parsed = policyRuleSchema.safeParse(rule);
  if (!parsed.success) {
    return {
      valid: false,
      report: {
        index,
        message: parsed.error.issues[0]?.message ?? 'Invalid rule.',
      },
    };
  }

  const validRule = parsed.data;
  const actual =
    validRule.field === 'Transaction Amount'
      ? transaction.amount
      : validRule.field === 'Asset Identifier'
        ? transaction.asset
        : (transaction.destination ?? '');

  let matched = false;
  let message = '';

  if (validRule.field === 'Transaction Amount') {
    const threshold = parseThresholdValue(validRule.value) ?? 0;
    matched = matchesNumeric(validRule.operator, actual as number, threshold);
    message = matched
      ? `Amount ${transaction.amount} matches ${validRule.operator.replace(/_/g, ' ')} ${threshold}.`
      : `Amount ${transaction.amount} does not match ${validRule.operator.replace(/_/g, ' ')} ${threshold}.`;
  } else if (validRule.field === 'Asset Identifier') {
    matched = matchesText(validRule.operator, actual as string, validRule.value);
    message = matched
      ? `Asset ${transaction.asset} matches ${validRule.operator.replace(/_/g, ' ')} ${validRule.value}.`
      : `Asset ${transaction.asset} does not match ${validRule.operator.replace(/_/g, ' ')} ${validRule.value}.`;
  } else if (validRule.field === 'Destination Target') {
    matched = matchesText(validRule.operator, actual as string, validRule.value);
    message = matched
      ? `Destination matches ${validRule.operator.replace(/_/g, ' ')} “${validRule.value}”.`
      : `Destination does not match ${validRule.operator.replace(/_/g, ' ')} “${validRule.value}”.`;
  } else {
    const entries = parseWhitelistEntries(validRule.value);
    const destination = (actual as string).trim().toLowerCase();
    if (validRule.operator === 'contains') {
      matched = entries.some((entry) => entry.toLowerCase() === destination);
    } else if (validRule.operator === 'equals') {
      matched = entries.length === 1 && entries[0]!.toLowerCase() === destination;
    } else {
      matched = entries.some((entry) => entry.toLowerCase() === destination);
    }
    message = matched
      ? `Destination ${transaction.destination ?? '—'} is on the whitelist.`
      : `Destination ${transaction.destination ?? '—'} is not on the whitelist.`;
  }

  return {
    valid: true,
    evaluation: {
      ruleId: ruleIdFor(validRule, index),
      index,
      field: validRule.field,
      operator: validRule.operator,
      action: validRule.action,
      matched,
      message,
    },
  };
}

/**
 * Evaluate every active rule against a transaction and resolve the most
 * restrictive outcome (block > require_approval > flag > allow). Overlapping
 * rules are all reported in `evaluations`/`violations`, while `outcome` is
 * deterministic: the strictest matched action wins.
 */
export function simulatePolicyRules(
  transaction: SimulatedTransaction,
  rules: readonly PolicyRuleDraft[],
): RuleSimulationResult {
  const evaluations: RuleEvaluation[] = [];
  const invalidRules: InvalidRuleReport[] = [];

  rules.forEach((rule, index) => {
    if (rule.enabled === false) return;
    const result = evaluateRule(rule, transaction, index);
    if (!result.valid) {
      invalidRules.push(result.report);
      return;
    }
    evaluations.push(result.evaluation);
  });

  const matched = evaluations.filter((evaluation) => evaluation.matched);
  const violations = matched.filter((evaluation) => evaluation.action !== 'allow');
  const permits = matched.filter((evaluation) => evaluation.action === 'allow');

  let outcome: SimulationOutcome = 'allow';
  let severity = ACTION_SEVERITY.allow;
  for (const evaluation of matched) {
    if (ACTION_SEVERITY[evaluation.action] > severity) {
      severity = ACTION_SEVERITY[evaluation.action];
      outcome = OUTCOME_BY_ACTION[evaluation.action];
    }
  }

  return {
    outcome,
    violations,
    permits,
    evaluations,
    invalidRules,
    passed: outcome === 'allow' || outcome === 'flag',
  };
}

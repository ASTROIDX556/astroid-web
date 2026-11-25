import { describe, expect, it } from 'vitest';

import {
  evaluateRule,
  isValidAssetCode,
  parseThresholdValue,
  parseWhitelistEntries,
  policyRuleSchema,
  simulatePolicyRules,
  validateRules,
  type PolicyRuleDraft,
} from './rulesSchema';

const amountRule = (overrides: Partial<PolicyRuleDraft> = {}): PolicyRuleDraft => ({
  field: 'Transaction Amount',
  operator: 'greater_than',
  value: '1000',
  action: 'require_approval',
  ...overrides,
});

describe('policyRuleSchema', () => {
  it('accepts a well-formed amount rule', () => {
    const result = policyRuleSchema.safeParse(amountRule());
    expect(result.success).toBe(true);
  });

  it('rejects zero and negative thresholds', () => {
    expect(policyRuleSchema.safeParse(amountRule({ value: '0' })).success).toBe(false);
    expect(policyRuleSchema.safeParse(amountRule({ value: '-1' })).success).toBe(false);
    expect(policyRuleSchema.safeParse(amountRule({ value: '-1000.5' })).success).toBe(
      false,
    );
  });

  it('rejects non-numeric and empty thresholds', () => {
    expect(policyRuleSchema.safeParse(amountRule({ value: '' })).success).toBe(false);
    expect(policyRuleSchema.safeParse(amountRule({ value: 'abc' })).success).toBe(
      false,
    );
    expect(policyRuleSchema.safeParse(amountRule({ value: 'Infinity' })).success).toBe(
      false,
    );
  });

  it('rejects invalid asset codes but accepts valid Stellar codes', () => {
    expect(isValidAssetCode('USDC')).toBe(true);
    expect(isValidAssetCode('usdc')).toBe(true);
    expect(isValidAssetCode('TOO-LONG-ASSET-CODE')).toBe(false);
    expect(isValidAssetCode('')).toBe(false);

    const invalid = policyRuleSchema.safeParse({
      field: 'Asset Identifier',
      operator: 'equals',
      value: 'NOT A CODE',
      action: 'block',
    });
    expect(invalid.success).toBe(false);
  });

  it('requires at least one whitelist entry', () => {
    const result = policyRuleSchema.safeParse({
      field: 'Approved Account Whitelist',
      operator: 'in_whitelist',
      value: ' , , ',
      action: 'allow',
    });
    expect(result.success).toBe(false);
  });

  it('rejects numeric operators on text fields', () => {
    const result = policyRuleSchema.safeParse({
      field: 'Destination Target',
      operator: 'greater_than',
      value: 'GABC',
      action: 'block',
    });
    expect(result.success).toBe(false);

    const evaluation = evaluateRule(
      {
        field: 'Destination Target',
        operator: 'greater_than',
        value: 'GABC',
        action: 'block',
      },
      { amount: 10, asset: 'XLM', destination: 'GABC' },
    );
    expect(evaluation.valid).toBe(false);
  });
});

describe('helpers', () => {
  it('parses finite thresholds only', () => {
    expect(parseThresholdValue(' 1500 ')).toBe(1500);
    expect(parseThresholdValue('-20')).toBe(-20);
    expect(parseThresholdValue('NaN')).toBeNull();
    expect(parseThresholdValue('')).toBeNull();
  });

  it('splits and trims whitelist entries', () => {
    expect(parseWhitelistEntries('G...A1, G...B2\nG...C3')).toEqual([
      'G...A1',
      'G...B2',
      'G...C3',
    ]);
  });
});

describe('simulatePolicyRules boundaries', () => {
  it('treats greater_than as exclusive at the exact threshold', () => {
    const rules = [amountRule({ value: '1000', operator: 'greater_than' })];

    const atBoundary = simulatePolicyRules({ amount: 1000, asset: 'XLM' }, rules);
    expect(atBoundary.violations).toHaveLength(0);
    expect(atBoundary.outcome).toBe('allow');
    expect(atBoundary.passed).toBe(true);

    const justAbove = simulatePolicyRules({ amount: 1000.01, asset: 'XLM' }, rules);
    expect(justAbove.violations).toHaveLength(1);
    expect(justAbove.outcome).toBe('require_approval');
    expect(justAbove.passed).toBe(false);
  });

  it('treats less_than as exclusive at the exact threshold', () => {
    const rules = [
      amountRule({ value: '500', operator: 'less_than', action: 'block' }),
    ];

    expect(simulatePolicyRules({ amount: 500, asset: 'XLM' }, rules).outcome).toBe(
      'allow',
    );
    expect(simulatePolicyRules({ amount: 499.99, asset: 'XLM' }, rules).outcome).toBe(
      'block',
    );
  });

  it('matches equals only at the exact threshold', () => {
    const rules = [amountRule({ value: '42.5', operator: 'equals', action: 'flag' })];

    expect(simulatePolicyRules({ amount: 42.5, asset: 'XLM' }, rules).outcome).toBe(
      'flag',
    );
    expect(simulatePolicyRules({ amount: 42.4, asset: 'XLM' }, rules).outcome).toBe(
      'allow',
    );
  });
});

describe('simulatePolicyRules overlap resolution', () => {
  it('applies the most restrictive matched action', () => {
    const rules: PolicyRuleDraft[] = [
      amountRule({ operator: 'greater_than', value: '1000', action: 'flag' }),
      amountRule({
        operator: 'greater_than',
        value: '2000',
        action: 'require_approval',
      }),
      amountRule({ operator: 'greater_than', value: '5000', action: 'block' }),
    ];

    const low = simulatePolicyRules({ amount: 1500, asset: 'XLM' }, rules);
    expect(low.outcome).toBe('flag');

    const mid = simulatePolicyRules({ amount: 2500, asset: 'XLM' }, rules);
    expect(mid.outcome).toBe('require_approval');
    expect(mid.violations).toHaveLength(2);

    const high = simulatePolicyRules({ amount: 9000, asset: 'XLM' }, rules);
    expect(high.outcome).toBe('block');
    expect(high.violations).toHaveLength(3);
  });

  it('keeps flag-only matches non-blocking', () => {
    const result = simulatePolicyRules({ amount: 9000, asset: 'XLM' }, [
      amountRule({ value: '1000', action: 'flag' }),
    ]);
    expect(result.outcome).toBe('flag');
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(1);
  });

  it('evaluates asset and whitelist conditions', () => {
    const rules: PolicyRuleDraft[] = [
      { field: 'Asset Identifier', operator: 'equals', value: 'USDC', action: 'block' },
      {
        field: 'Approved Account Whitelist',
        operator: 'in_whitelist',
        value: 'GALLOW1, GALLOW2',
        action: 'allow',
      },
    ];

    const result = simulatePolicyRules(
      { amount: 10, asset: 'USDC', destination: 'GALLOW1' },
      rules,
    );
    expect(result.outcome).toBe('block');
    expect(result.permits).toHaveLength(1);
    expect(result.violations).toHaveLength(1);

    const allowed = simulatePolicyRules(
      { amount: 10, asset: 'XLM', destination: 'GALLOW1' },
      rules,
    );
    expect(allowed.outcome).toBe('allow');
    expect(allowed.permits).toHaveLength(1);
  });
});

describe('simulatePolicyRules robustness', () => {
  it('skips disabled rules', () => {
    const result = simulatePolicyRules({ amount: 9999, asset: 'XLM' }, [
      amountRule({ value: '100', action: 'block', enabled: false }),
    ]);
    expect(result.outcome).toBe('allow');
    expect(result.evaluations).toHaveLength(0);
  });

  it('reports invalid rules without throwing and still evaluates valid ones', () => {
    const result = simulatePolicyRules({ amount: 9999, asset: 'XLM' }, [
      amountRule({ value: '-5', action: 'block' }),
      amountRule({ value: '1000', action: 'require_approval' }),
    ]);
    expect(result.invalidRules).toHaveLength(1);
    expect(result.invalidRules[0]?.index).toBe(0);
    expect(result.outcome).toBe('require_approval');
  });

  it('returns allow when there are no rules', () => {
    const result = simulatePolicyRules({ amount: 100, asset: 'XLM' }, []);
    expect(result.outcome).toBe('allow');
    expect(result.passed).toBe(true);
    expect(result.evaluations).toHaveLength(0);
  });
});

describe('validateRules', () => {
  it('partitions valid rules from indexed errors', () => {
    const { rules, errors } = validateRules([
      amountRule({ value: '100' }),
      amountRule({ value: '-1' }),
      {
        field: 'Asset Identifier',
        operator: 'equals',
        value: 'USDC',
        action: 'allow',
      },
    ]);
    expect(rules).toHaveLength(2);
    expect(errors).toEqual([
      { index: 1, message: 'Amount threshold must be greater than zero.' },
    ]);
  });
});

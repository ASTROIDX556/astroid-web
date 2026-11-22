import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  computeRiskScore,
  evaluatePolicyRules,
  type EvaluationStep,
  type SandboxFormValues,
} from './spendingPolicySimulation';
import type { PolicyRule } from './usePolicySimulation';
import {
  configFromPolicies,
  evaluateProposedTransaction,
  type ProposedTransaction,
} from './policyEvaluation';
import {
  describeFeeSufficiencyViolation,
  evaluateAmountBoundary,
  evaluateFeeSufficiency,
  feeRiskBadgeDescriptor,
  isAssetAllowed,
  isStellarAssetCode,
  normalizeAssetCode,
  parseAssetOperationList,
} from './policySimulationEdgeCases';
import type { Policy } from '../../types/domain';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RECIPIENT = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const VENDOR_FRAGMENT = 'P7UJVSGZ';

const baseTransaction: SandboxFormValues = {
  recipient: RECIPIENT,
  amount: 500,
  asset: 'USDC',
  agentId: 'agt_atlas',
  memo: 'test',
};

const rule = (overrides: Partial<PolicyRule>): PolicyRule => ({
  id: 'rule-1',
  name: 'Test rule',
  type: 'max_amount',
  description: '',
  enabled: true,
  ...overrides,
});

const outcomeOf = (
  transaction: SandboxFormValues,
  rules: PolicyRule[],
  options?: Parameters<typeof evaluatePolicyRules>[2],
) => evaluatePolicyRules(transaction, rules, options);

// ---------------------------------------------------------------------------
// evaluatePolicyRules — per-transaction caps
// ---------------------------------------------------------------------------

describe('policy simulation helpers — per-transaction caps', () => {
  test('amount exactly at the max_amount threshold passes', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'max_amount', threshold: 500 }),
    ]);
    assert.equal(result.outcome, 'approved');
    assert.equal(result.steps[0]?.reasonCode, 'AMOUNT_WITHIN_CAP');
  });

  test('amount above the cap is rejected as a blocking violation', () => {
    const result = outcomeOf(
      { ...baseTransaction, amount: 500.01 },
      [rule({ type: 'max_amount', threshold: 500 })],
    );
    assert.equal(result.outcome, 'rejected');
    assert.equal(result.steps[0]?.reasonCode, 'AMOUNT_EXCEEDS_THRESHOLD');
  });

  test('a zero threshold rejects any positive amount', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'max_amount', threshold: 0 }),
    ]);
    assert.equal(result.outcome, 'rejected');
  });

  test('budget_limit uses the same boundary semantics', () => {
    const atCap = outcomeOf(baseTransaction, [
      rule({ type: 'budget_limit', budgetLimitUsd: 500 }),
    ]);
    assert.equal(atCap.outcome, 'approved');

    const over = outcomeOf({ ...baseTransaction, amount: 501 }, [
      rule({ type: 'budget_limit', budgetLimitUsd: 500 }),
    ]);
    assert.equal(over.outcome, 'rejected');
    assert.equal(over.steps[0]?.reasonCode, 'BUDGET_EXCEEDED');
  });

  test('disabled rules are skipped entirely', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'max_amount', threshold: 1, enabled: false }),
      rule({ type: 'emergency_lock', emergencyActive: true, enabled: false }),
    ]);
    assert.equal(result.steps.length, 0);
    assert.equal(result.outcome, 'approved');
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicyRules — recipient whitelists and blocklists
// ---------------------------------------------------------------------------

describe('policy simulation helpers — recipient rules', () => {
  test('allowed_recipients passes when the recipient matches the whitelist', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'allowed_recipients', allowedRecipients: [VENDOR_FRAGMENT] }),
    ]);
    assert.equal(result.steps[0]?.passed, true);
    assert.equal(result.steps[0]?.reasonCode, 'RECIPIENT_ALLOWED');
  });

  test('allowed_recipients rejects non-matching recipients', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'allowed_recipients', allowedRecipients: ['ZZZZNOTPRESENT'] }),
    ]);
    assert.equal(result.outcome, 'rejected');
    assert.equal(result.steps[0]?.reasonCode, 'RECIPIENT_BLOCKED');
  });

  test('an empty allowed_recipients list approves every recipient', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'allowed_recipients', allowedRecipients: [] }),
    ]);
    assert.equal(result.steps[0]?.passed, true);
  });

  test('blocked_recipients halts a deny-listed recipient', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'blocked_recipients', blockedRecipients: [VENDOR_FRAGMENT] }),
    ]);
    assert.equal(result.outcome, 'rejected');
    assert.equal(result.steps[0]?.reasonCode, 'RECIPIENT_BLOCKED');
  });

  test('blocked_recipients passes a clean recipient', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'blocked_recipients', blockedRecipients: ['ZZZZNOTPRESENT'] }),
    ]);
    assert.equal(result.steps[0]?.passed, true);
    assert.equal(result.steps[0]?.reasonCode, 'RECIPIENT_CLEAR');
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicyRules — time windows (UTC, injected clock)
// ---------------------------------------------------------------------------

describe('policy simulation helpers — time windows', () => {
  const windowRule = rule({
    type: 'time_window',
    windowStart: '09:00',
    windowEnd: '17:00',
  });
  const at = (iso: string) => new Date(iso);

  test('inside the window passes', () => {
    const result = outcomeOf(baseTransaction, [windowRule], {
      currentTime: at('2026-03-10T12:30:00Z'),
    });
    assert.equal(result.steps[0]?.passed, true);
    assert.equal(result.steps[0]?.reasonCode, 'TIME_WINDOW_OPEN');
  });

  test('exact window boundaries are inclusive', () => {
    for (const iso of ['2026-03-10T09:00:00Z', '2026-03-10T17:00:00Z']) {
      const result = outcomeOf(baseTransaction, [windowRule], {
        currentTime: at(iso),
      });
      assert.equal(result.steps[0]?.passed, true, iso);
    }
  });

  test('just outside either boundary fails', () => {
    for (const iso of ['2026-03-10T08:59:00Z', '2026-03-10T17:01:00Z']) {
      const result = outcomeOf(baseTransaction, [windowRule], {
        currentTime: at(iso),
      });
      assert.equal(result.steps[0]?.passed, false, iso);
      assert.equal(result.steps[0]?.reasonCode, 'TIME_WINDOW_CLOSED');
    }
  });

  test('evaluation uses UTC minutes regardless of host timezone', () => {
    // 23:30 UTC is outside a 09:00–17:00 window even where local time differs.
    const result = outcomeOf(baseTransaction, [windowRule], {
      currentTime: at('2026-03-10T23:30:00Z'),
    });
    assert.equal(result.steps[0]?.passed, false);
  });

  test('an overnight window (start after end) never opens', () => {
    const overnight = rule({
      type: 'time_window',
      windowStart: '22:00',
      windowEnd: '06:00',
    });
    for (const iso of ['2026-03-10T23:00:00Z', '2026-03-10T02:00:00Z']) {
      const result = outcomeOf(baseTransaction, [overnight], {
        currentTime: at(iso),
      });
      assert.equal(result.steps[0]?.passed, false, iso);
    }
  });

  test('a rule without window bounds has nothing to enforce', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'time_window' }),
    ]);
    assert.equal(result.steps[0]?.passed, true); // no bounds → nothing to enforce
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicyRules — outcome severity, multi-sig, emergency lock, risk
// ---------------------------------------------------------------------------

describe('policy simulation helpers — outcome severity', () => {
  test('multi_sig shortfall flags rather than rejects', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'multi_sig', requiredCoSigners: 3 }),
    ], { mockSimulatedSignerCount: 1 });
    assert.equal(result.outcome, 'flagged');
    assert.equal(result.steps[0]?.reasonCode, 'MULTISIG_INSUFFICIENT');
  });

  test('multi_sig satisfied when enough co-signers are simulated', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'multi_sig', requiredCoSigners: 2 }),
    ], { mockSimulatedSignerCount: 2 });
    assert.equal(result.steps[0]?.passed, true);
  });

  test('active emergency lock rejects every transaction', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'emergency_lock', emergencyActive: true }),
    ]);
    assert.equal(result.outcome, 'rejected');
    assert.equal(result.steps[0]?.reasonCode, 'EMERGENCY_ACTIVE');
  });

  test('inactive emergency lock passes', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'emergency_lock', emergencyActive: false }),
    ]);
    assert.equal(result.steps[0]?.passed, true);
  });

  test('rate_limit rules evaluate as informational notes', () => {
    const result = outcomeOf(baseTransaction, [
      rule({ type: 'rate_limit', rateLimitPerHour: 10 }),
    ]);
    assert.equal(result.steps[0]?.passed, true);
    assert.equal(result.steps[0]?.reasonCode, 'RATE_LIMIT_NOTE');
  });

  test('allowed_assets enforces the asset allow-list', () => {
    const pass = outcomeOf({ ...baseTransaction, asset: 'USDC' }, [
      rule({ type: 'allowed_assets', allowedAssets: ['USDC', 'XLM'] }),
    ]);
    assert.equal(pass.outcome, 'approved');

    const fail = outcomeOf({ ...baseTransaction, asset: 'BTC' }, [
      rule({ type: 'allowed_assets', allowedAssets: ['USDC', 'XLM'] }),
    ]);
    assert.equal(fail.outcome, 'rejected');
    assert.equal(fail.steps[0]?.reasonCode, 'ASSET_BLOCKED');
  });
});

describe('computeRiskScore', () => {
  const step = (passed: boolean): EvaluationStep => ({
    ruleId: 'r',
    ruleName: 'r',
    passed,
    message: '',
    reasonCode: '',
  });

  test('each failed step adds 25 points', () => {
    const score = computeRiskScore(baseTransaction, [step(true), step(false)]);
    assert.equal(score, 25);
  });

  test('large amounts add graduated bonuses and the score caps at 100', () => {
    const manyFailures = [step(false), step(false), step(false), step(false)];
    const big = computeRiskScore(
      { ...baseTransaction, amount: 30000 },
      manyFailures,
    );
    // 4 * 25 + 20 (>25000) + 10 (>10000) = 130 → capped at 100.
    assert.equal(big, 100);
  });

  test('small approved transactions score zero', () => {
    assert.equal(computeRiskScore(baseTransaction, [step(true)]), 0);
  });
});

// ---------------------------------------------------------------------------
// evaluateProposedTransaction + configFromPolicies
// ---------------------------------------------------------------------------

const VALID_KEY = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';

const proposed: ProposedTransaction = {
  amount: 100,
  recipient: VALID_KEY,
  department: 'Engineering',
  asset: 'USDC',
};

const domainPolicy = (overrides: Partial<Policy>): Policy => ({
  id: 'pol-1',
  organizationId: 'org-1',
  name: 'Policy',
  description: '',
  type: 'max_spend',
  configuration: {},
  priority: 1,
  enabled: true,
  appliesTo: 1,
  violations30d: 0,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('evaluateProposedTransaction', () => {
  test('rejects malformed recipients before evaluating rules', () => {
    assert.throws(() =>
      evaluateProposedTransaction(
        { ...proposed, recipient: 'not-an-address' },
        { maxTransactionAmount: 1000 },
      ),
    );
  });

  test('amount at the transaction ceiling passes, above it fails', () => {
    const atCap = evaluateProposedTransaction(proposed, {
      maxTransactionAmount: 100,
    });
    assert.equal(atCap.passed, true);

    const over = evaluateProposedTransaction(
      { ...proposed, amount: 100.01 },
      { maxTransactionAmount: 100 },
    );
    assert.equal(over.passed, false);
    assert.equal(over.rules[0]?.id, 'max-transaction');
  });

  test('zero limits fail closed for any positive amount', () => {
    const result = evaluateProposedTransaction(proposed, {
      maxTransactionAmount: 0,
      dailyLimit: 0,
    });
    assert.equal(result.passed, false);
    assert.ok(result.rules.every((rule) => !rule.passed));
  });

  test('daily limit accounts for spend already committed today', () => {
    const fits = evaluateProposedTransaction(proposed, {
      dailyLimit: 200,
      dailySpent: 50,
    });
    assert.equal(fits.passed, true);

    const breaches = evaluateProposedTransaction(
      { ...proposed, amount: 151 },
      { dailyLimit: 200, dailySpent: 50 },
    );
    assert.equal(breaches.passed, false);
    assert.equal(breaches.rules[0]?.id, 'daily-limit');
    assert.equal(breaches.rules[0]?.actual, '201');
  });

  test('department budget is evaluated per department', () => {
    const result = evaluateProposedTransaction(
      { ...proposed, amount: 60, department: 'Marketing' },
      { departmentBudget: 100, departmentSpent: 50 },
    );
    assert.equal(result.passed, false);
    assert.match(result.rules[0]?.label ?? '', /Marketing/);
  });

  test('recipient whitelist requires an exact G-address match', () => {
    const pass = evaluateProposedTransaction(proposed, {
      allowedRecipients: [VALID_KEY],
    });
    assert.equal(pass.passed, true);

    const fail = evaluateProposedTransaction(proposed, {
      allowedRecipients: [
        'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      ],
    });
    assert.equal(fail.passed, false);
    assert.equal(fail.rules[0]?.id, 'recipient-whitelist');
  });

  test('an empty policy config fails closed with no-policies', () => {
    const result = evaluateProposedTransaction(proposed, {});
    assert.equal(result.passed, false);
    assert.equal(result.rules[0]?.id, 'no-policies');
    assert.equal(result.simulated, true);
  });
});

describe('configFromPolicies', () => {
  test('maps each supported policy type into simulation config', () => {
    const config = configFromPolicies([
      domainPolicy({
        type: 'max_spend',
        configuration: { maxAmount: 500 },
      }),
      domainPolicy({
        id: 'pol-2',
        type: 'daily_budget',
        configuration: { limit: 1000, spent: 200 },
      }),
      domainPolicy({
        id: 'pol-3',
        type: 'monthly_budget',
        configuration: { limit: 5000, spent: 100 },
      }),
      domainPolicy({
        id: 'pol-4',
        type: 'allowed_recipients',
        configuration: { recipients: [VALID_KEY, 42, null] },
      }),
    ]);

    assert.equal(config.maxTransactionAmount, 500);
    assert.equal(config.dailyLimit, 1000);
    assert.equal(config.dailySpent, 200);
    assert.equal(config.departmentBudget, 5000);
    assert.equal(config.departmentSpent, 100);
    assert.deepEqual(config.allowedRecipients, [VALID_KEY]);
  });

  test('disabled policies contribute nothing', () => {
    const config = configFromPolicies([
      domainPolicy({
        type: 'max_spend',
        enabled: false,
        configuration: { maxAmount: 500 },
      }),
    ]);
    assert.deepEqual(config, {});
  });

  test('non-numeric configuration values are ignored', () => {
    const config = configFromPolicies([
      domainPolicy({
        type: 'max_spend',
        configuration: { maxAmount: 'lots' },
      }),
      domainPolicy({
        id: 'pol-2',
        type: 'daily_budget',
        configuration: { limit: Number.NaN },
      }),
    ]);
    assert.equal(config.maxTransactionAmount, undefined);
    assert.equal(config.dailyLimit, undefined);
  });
});

// ---------------------------------------------------------------------------
// policySimulationEdgeCases — boundary, asset codes, fee sufficiency
// ---------------------------------------------------------------------------

describe('evaluateAmountBoundary', () => {
  test('classifies within, at-limit, and over', () => {
    assert.equal(evaluateAmountBoundary(90, 100)?.outcome, 'within');
    const at = evaluateAmountBoundary(100, 100);
    assert.equal(at?.outcome, 'at_limit');
    assert.equal(at?.atLimit, true);
    assert.equal(evaluateAmountBoundary(101, 100)?.outcome, 'over');
    assert.equal(evaluateAmountBoundary(101, 100)?.delta, 1);
  });

  test('non-finite inputs degrade to null', () => {
    assert.equal(evaluateAmountBoundary(Number.NaN, 100), null);
    assert.equal(evaluateAmountBoundary(100, Number.POSITIVE_INFINITY), null);
  });
});

describe('asset code helpers', () => {
  test('isStellarAssetCode accepts 1-12 char uppercase alphanumeric codes', () => {
    assert.equal(isStellarAssetCode('XLM'), true);
    assert.equal(isStellarAssetCode('USDC'), true);
    assert.equal(isStellarAssetCode('A'.repeat(12)), true);
    assert.equal(isStellarAssetCode('A'.repeat(13)), false);
    assert.equal(isStellarAssetCode('usd c'), false);
    assert.equal(isStellarAssetCode(''), false);
  });

  test('normalizeAssetCode trims and uppercases, rejecting invalid codes', () => {
    assert.equal(normalizeAssetCode('  usdc '), 'USDC');
    assert.equal(normalizeAssetCode('bad code!'), null);
    assert.equal(normalizeAssetCode(''), null);
  });

  test('isAssetAllowed performs exact membership checks', () => {
    assert.equal(isAssetAllowed('USDC', ['USDC', 'XLM']), true);
    assert.equal(isAssetAllowed('usdc', ['USDC']), false);
    assert.equal(isAssetAllowed('BTC', []), false);
  });
});

describe('parseAssetOperationList', () => {
  test('parses semicolon-delimited custom asset operations', () => {
    const ops = parseAssetOperationList(
      'payment,USDC,100,GDEST;payment,MYTOKEN,50',
    );
    assert.equal(ops?.length, 2);
    assert.equal(ops?.[0]?.asset, 'USDC');
    assert.equal(ops?.[1]?.asset, 'MYTOKEN');
    assert.equal(ops?.[1]?.source, 'manual input');
  });

  test('rejects malformed payloads so callers fall back to XDR heuristics', () => {
    assert.equal(parseAssetOperationList('no-commas-here'), null);
    assert.equal(parseAssetOperationList('payment,USDC'), null);
    assert.equal(parseAssetOperationList('payment,USDC,abc'), null);
    assert.equal(parseAssetOperationList('payment,USDC,-5'), null);
    assert.equal(parseAssetOperationList('payment,INVALID CODE!,10'), null);
  });
});

describe('evaluateFeeSufficiency', () => {
  test('sufficient when a full fee reserve survives the transaction', () => {
    const result = evaluateFeeSufficiency({
      availableBalance: 1000,
      transactionAmount: 500,
      networkFee: 10,
    });
    assert.equal(result.status, 'sufficient');
    assert.equal(result.remainingAfterTransaction, 490);
  });

  test('low when the remainder cannot cover another network fee', () => {
    const result = evaluateFeeSufficiency({
      availableBalance: 515,
      transactionAmount: 500,
      networkFee: 10,
    });
    assert.equal(result.status, 'low');
    assert.equal(result.remainingAfterTransaction, 5);
  });

  test('insufficient when amount plus fee exceeds the balance', () => {
    const result = evaluateFeeSufficiency({
      availableBalance: 500,
      transactionAmount: 495,
      networkFee: 10,
    });
    assert.equal(result.status, 'insufficient');
    assert.equal(result.remainingAfterTransaction, -5);
  });

  test('boundary: remainder exactly equal to the fee is sufficient', () => {
    const result = evaluateFeeSufficiency({
      availableBalance: 520,
      transactionAmount: 500,
      networkFee: 10,
    });
    assert.equal(result.status, 'sufficient');
  });

  test('a zero remainder is low — no fee reserve survives', () => {
    const result = evaluateFeeSufficiency({
      availableBalance: 510,
      transactionAmount: 500,
      networkFee: 10,
    });
    assert.equal(result.status, 'low');
    assert.equal(result.remainingAfterTransaction, 0);
  });

  test('invalid on non-finite or negative inputs', () => {
    for (const input of [
      { availableBalance: -1, transactionAmount: 0, networkFee: 1 },
      { availableBalance: Number.NaN, transactionAmount: 0, networkFee: 1 },
      { availableBalance: 100, transactionAmount: -5, networkFee: 1 },
      { availableBalance: 100, transactionAmount: 0, networkFee: -1 },
    ]) {
      assert.equal(evaluateFeeSufficiency(input).status, 'invalid');
    }
  });
});

describe('fee sufficiency descriptors', () => {
  test('describes insufficient and low verdicts, hides the rest', () => {
    const insufficient = evaluateFeeSufficiency({
      availableBalance: 100,
      transactionAmount: 95,
      networkFee: 10,
    });
    assert.equal(
      describeFeeSufficiencyViolation(insufficient, 'stroops')?.severity,
      'danger',
    );

    const low = evaluateFeeSufficiency({
      availableBalance: 105,
      transactionAmount: 95,
      networkFee: 10,
    });
    assert.equal(describeFeeSufficiencyViolation(low, 'stroops')?.severity, 'warning');

    const sufficient = evaluateFeeSufficiency({
      availableBalance: 1000,
      transactionAmount: 100,
      networkFee: 10,
    });
    assert.equal(describeFeeSufficiencyViolation(sufficient, 'stroops'), null);
  });

  test('feeRiskBadgeDescriptor maps verdicts to badge levels', () => {
    const insufficient = evaluateFeeSufficiency({
      availableBalance: 10,
      transactionAmount: 5,
      networkFee: 10,
    });
    assert.deepEqual(feeRiskBadgeDescriptor(insufficient), {
      level: 'danger',
      label: 'Balance below fees',
    });

    const sufficient = evaluateFeeSufficiency({
      availableBalance: 1000,
      transactionAmount: 10,
      networkFee: 1,
    });
    assert.equal(feeRiskBadgeDescriptor(sufficient), null);
  });
});

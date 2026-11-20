import assert from 'node:assert/strict';
import test from 'node:test';
import {
  agentWithdrawalRulesSchema,
  validateAgentWithdrawalRules,
  type AgentWithdrawalRules,
} from './withdrawal-schema';

const validWithdrawalRules = {
  maxTransactionAmount: 125.1234567,
  dailyWithdrawalLimit: 1_000,
  allowedAssets: ['XLM', 'USDC'],
} satisfies AgentWithdrawalRules;

test('withdrawal rules accept valid amount limits and authorized assets', () => {
  const result = agentWithdrawalRulesSchema.safeParse(validWithdrawalRules);

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data, validWithdrawalRules);
  }
});

test('withdrawal limits reject zero and negative amounts', () => {
  for (const amount of [0, -1, -0.5]) {
    const result = agentWithdrawalRulesSchema.safeParse({
      ...validWithdrawalRules,
      maxTransactionAmount: amount,
    });

    assert.equal(result.success, false, String(amount));
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => issue.path[0] === 'maxTransactionAmount'));
    }
  }
});

test('withdrawal limits reject amounts with more than seven decimal places', () => {
  const result = agentWithdrawalRulesSchema.safeParse({
    ...validWithdrawalRules,
    dailyWithdrawalLimit: 0.00000001,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path[0] === 'dailyWithdrawalLimit'));
  }
});

test('asset whitelist rejects invalid codes and accepts trimmed valid codes', () => {
  const invalid = agentWithdrawalRulesSchema.safeParse({
    ...validWithdrawalRules,
    allowedAssets: ['USDC', 'NOT-A-CODE'],
  });
  assert.equal(invalid.success, false);

  const valid = agentWithdrawalRulesSchema.safeParse({
    ...validWithdrawalRules,
    allowedAssets: [' XLM ', 'USDC'],
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.deepEqual(valid.data.allowedAssets, ['XLM', 'USDC']);
  }
});

test('asset whitelist requires at least one unique asset', () => {
  const empty = agentWithdrawalRulesSchema.safeParse({
    ...validWithdrawalRules,
    allowedAssets: [],
  });
  assert.equal(empty.success, false);

  const duplicate = agentWithdrawalRulesSchema.safeParse({
    ...validWithdrawalRules,
    allowedAssets: ['XLM', 'XLM'],
  });
  assert.equal(duplicate.success, false);
});

test('reusable form validator returns safe-parse results', () => {
  assert.equal(validateAgentWithdrawalRules(validWithdrawalRules).success, true);
  assert.equal(validateAgentWithdrawalRules({}).success, false);
});

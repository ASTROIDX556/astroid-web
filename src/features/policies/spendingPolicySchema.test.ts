import assert from 'node:assert/strict';
import test from 'node:test';
import {
  policySimulationInputSchema,
  spendingPolicySchema,
} from './spendingPolicySchema';

const VALID_KEY = 'G' + 'A'.repeat(55);

const validPolicy = {
  name: 'Treasury burn guard',
  maxSingleTransactionLimit: 2000,
  rollingBudgetLimit: 20000,
  rollingBudgetInterval: 'weekly',
  whitelistAddresses: VALID_KEY,
  allowedAssets: 'XLM, USDC',
} as const;

test('accepts a valid policy and coerces numeric strings', () => {
  const result = spendingPolicySchema.safeParse({
    ...validPolicy,
    maxSingleTransactionLimit: '2,000',
    rollingBudgetLimit: '$20,000.00',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.maxSingleTransactionLimit, 2000);
    assert.equal(result.data.rollingBudgetLimit, 20000);
  }
});

test('rejects negative, zero, and non-numeric limits', () => {
  for (const [field, value] of [
    ['maxSingleTransactionLimit', '-5'],
    ['maxSingleTransactionLimit', '0'],
    ['maxSingleTransactionLimit', 'abc'],
    ['rollingBudgetLimit', '-1'],
    ['rollingBudgetLimit', ''],
  ] as const) {
    const result = spendingPolicySchema.safeParse({ ...validPolicy, [field]: value });
    assert.equal(result.success, false, `${field}=${value}`);
  }
});

test('normalizes asset codes to uppercase alphanumeric form', () => {
  const result = spendingPolicySchema.safeParse({
    ...validPolicy,
    allowedAssets: ' xlm , us:dc , EURC ',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.allowedAssets, 'XLM, USDC, EURC');
  }
});

test('rejects malformed asset codes and empty asset lists', () => {
  for (const allowedAssets of ['', '   ', ',,,', 'XLM, WAY-TOO-LONG-CODE-123']) {
    const result = spendingPolicySchema.safeParse({ ...validPolicy, allowedAssets });
    assert.equal(result.success, false, JSON.stringify(allowedAssets));
  }
});

test('normalizes whitelist addresses and rejects invalid keys', () => {
  const lower = VALID_KEY.toLowerCase();
  const normalized = spendingPolicySchema.safeParse({
    ...validPolicy,
    whitelistAddresses: ` ${lower} `,
  });
  assert.equal(normalized.success, true);
  if (normalized.success) {
    assert.equal(normalized.data.whitelistAddresses, VALID_KEY);
  }

  for (const whitelistAddresses of ['not-a-key', VALID_KEY + ', bogus']) {
    const result = spendingPolicySchema.safeParse({ ...validPolicy, whitelistAddresses });
    assert.equal(result.success, false, whitelistAddresses);
  }
});

test('simulation input sanitizes amount and asset type', () => {
  const result = policySimulationInputSchema.safeParse({
    amount: '1,500',
    recipientAddress: VALID_KEY,
    assetType: ' usdc ',
    agentId: 'agent-1',
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.amount, 1500);
    assert.equal(result.data.assetType, 'USDC');
  }
});

test('simulation input rejects non-positive amounts and bad recipients', () => {
  for (const amount of ['0', '-10', 'abc']) {
    const result = policySimulationInputSchema.safeParse({
      amount,
      recipientAddress: VALID_KEY,
      assetType: 'XLM',
      agentId: 'agent-1',
    });
    assert.equal(result.success, false, amount);
  }

  const badRecipient = policySimulationInputSchema.safeParse({
    amount: 10,
    recipientAddress: 'G' + 'A'.repeat(54),
    assetType: 'XLM',
    agentId: 'agent-1',
  });
  assert.equal(badRecipient.success, false);
});

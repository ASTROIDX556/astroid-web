import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  describeFeeSufficiencyViolation,
  evaluateAmountBoundary,
  evaluateFeeSufficiency,
  isAssetAllowed,
  isStellarAssetCode,
  NATIVE_ASSET_CODE,
  normalizeAssetCode,
  parseAssetOperationList,
} from './policySimulationEdgeCases';

describe('Spending policy edge cases & boundary helpers (#423)', () => {
  // -------------------------------------------------------------------------
  // 1. Amount Boundary Checks (evaluateAmountBoundary)
  // -------------------------------------------------------------------------
  describe('evaluateAmountBoundary', () => {
    test('returns at_limit when amount exactly equals threshold', () => {
      const result = evaluateAmountBoundary(5000, 5000);
      assert.notEqual(result, null);
      assert.equal(result?.outcome, 'at_limit');
      assert.equal(result?.atLimit, true);
      assert.equal(result?.over, false);
      assert.equal(result?.delta, 0);
    });

    test('returns within when amount is below threshold', () => {
      const result = evaluateAmountBoundary(4999.99, 5000);
      assert.notEqual(result, null);
      assert.equal(result?.outcome, 'within');
      assert.equal(result?.atLimit, false);
      assert.equal(result?.over, false);
      assert.ok((result?.delta ?? 0) < 0);
    });

    test('returns over when amount exceeds threshold', () => {
      const result = evaluateAmountBoundary(5000.01, 5000);
      assert.notEqual(result, null);
      assert.equal(result?.outcome, 'over');
      assert.equal(result?.atLimit, false);
      assert.equal(result?.over, true);
      assert.ok((result?.delta ?? 0) > 0);
    });

    test('returns null when either amount or threshold is non-finite', () => {
      assert.equal(evaluateAmountBoundary(NaN, 5000), null);
      assert.equal(evaluateAmountBoundary(5000, Infinity), null);
      assert.equal(evaluateAmountBoundary(-Infinity, 5000), null);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Stellar Asset Code Normalization & Operations Parser
  // -------------------------------------------------------------------------
  describe('Stellar asset code helpers', () => {
    test('identifies native asset code as XLM', () => {
      assert.equal(NATIVE_ASSET_CODE, 'XLM');
    });

    test('validates 1 to 12 alphanumeric Stellar asset codes', () => {
      assert.equal(isStellarAssetCode('XLM'), true);
      assert.equal(isStellarAssetCode('USDC'), true);
      assert.equal(isStellarAssetCode('TOKEN12CHARS'), true);
      // Too long (13 chars)
      assert.equal(isStellarAssetCode('TOOLONGASSET13'), false);
      // Invalid symbols
      assert.equal(isStellarAssetCode('USD$'), false);
      assert.equal(isStellarAssetCode(''), false);
    });

    test('normalizes asset code by trimming and uppercasing', () => {
      assert.equal(normalizeAssetCode('  usdc  '), 'USDC');
      assert.equal(normalizeAssetCode('xlm'), 'XLM');
      assert.equal(normalizeAssetCode('invalid@asset'), null);
    });

    test('parses plaintext comma-delimited operation list', () => {
      const payload = 'payment,USDC,500,GA7QYNF7;payment,XLM,100';
      const parsed = parseAssetOperationList(payload);
      assert.notEqual(parsed, null);
      assert.equal(parsed?.length, 2);
      assert.equal(parsed?.[0]?.asset, 'USDC');
      assert.equal(parsed?.[0]?.amount, '500');
      assert.equal(parsed?.[1]?.asset, 'XLM');
      assert.equal(parsed?.[1]?.source, 'manual input');
    });

    test('rejects malformed operation payloads cleanly', () => {
      assert.equal(parseAssetOperationList('no-commas-here'), null);
      assert.equal(parseAssetOperationList('payment,INVALID@ASSET,-100'), null);
      assert.equal(parseAssetOperationList(''), null);
    });

    test('evaluates asset eligibility against allowed asset list', () => {
      const allowed = ['XLM', 'USDC', 'EURC'];
      assert.equal(isAssetAllowed('USDC', allowed), true);
      assert.equal(isAssetAllowed('BTC', allowed), false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Fee Sufficiency and Low-Balance Depletion Checks
  // -------------------------------------------------------------------------
  describe('Fee sufficiency evaluation (evaluateFeeSufficiency)', () => {
    test('returns sufficient when remaining balance comfortably covers fee reserve', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 1000,
        transactionAmount: 500,
        networkFee: 10,
      });
      assert.equal(result.status, 'sufficient');
      assert.equal(result.remainingAfterTransaction, 490);
    });

    test('returns low when remaining balance is positive but less than one network fee', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 1000,
        transactionAmount: 995,
        networkFee: 10,
      });
      // 1000 - 995 - 10 = -5 -> insufficient
      // Let availableBalance = 1005: 1005 - 995 - 10 = 0 -> < 10 (low)
      const lowResult = evaluateFeeSufficiency({
        availableBalance: 1007,
        transactionAmount: 1000,
        networkFee: 10,
      });
      // 1007 - 1000 - 10 = -3
      // Let availableBalance = 1015: 1015 - 1000 - 10 = 5 (< 10)
      const actualLow = evaluateFeeSufficiency({
        availableBalance: 1015,
        transactionAmount: 1000,
        networkFee: 10,
      });
      assert.equal(actualLow.status, 'low');
      assert.equal(actualLow.remainingAfterTransaction, 5);
    });

    test('returns insufficient when amount + fee exceeds available balance', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 100,
        transactionAmount: 100,
        networkFee: 10,
      });
      // 100 - 100 - 10 = -10
      assert.equal(result.status, 'insufficient');
      assert.equal(result.remainingAfterTransaction, -10);
    });

    test('returns invalid when inputs are negative or non-finite', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: -50,
        transactionAmount: 100,
        networkFee: 10,
      });
      assert.equal(result.status, 'invalid');
      assert.ok(Number.isNaN(result.remainingAfterTransaction));
    });

    test('describes fee sufficiency violations accurately', () => {
      const dangerViolation = describeFeeSufficiencyViolation(
        { status: 'insufficient', remainingAfterTransaction: -25 },
        'stroops',
      );
      assert.equal(dangerViolation?.severity, 'danger');
      assert.match(dangerViolation?.message ?? '', /Insufficient balance/);

      const warningViolation = describeFeeSufficiencyViolation(
        { status: 'low', remainingAfterTransaction: 5 },
        'stroops',
      );
      assert.equal(warningViolation?.severity, 'warning');
      assert.match(warningViolation?.message ?? '', /less than one network fee of reserve/i);

      const noneViolation = describeFeeSufficiencyViolation(
        { status: 'sufficient', remainingAfterTransaction: 500 },
        'stroops',
      );
      assert.equal(noneViolation, null);
    });
  });
});

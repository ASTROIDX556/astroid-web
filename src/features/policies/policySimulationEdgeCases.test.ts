import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  describeFeeSufficiencyViolation,
  evaluateAmountBoundary,
  evaluateFeeSufficiency,
  feeRiskBadgeDescriptor,
  isAssetAllowed,
  isStellarAssetCode,
  normalizeAssetCode,
  parseAssetOperationList,
  type AmountBoundaryCheck,
  type FeeSufficiencyResult,
} from './policySimulationEdgeCases';

describe('Policy engine edge cases (#505)', () => {
  // -------------------------------------------------------------------------
  // 1. Exact spending-limit boundary values (evaluateAmountBoundary)
  // -------------------------------------------------------------------------
  describe('evaluateAmountBoundary — boundary threshold values', () => {
    test('amount below threshold is within', () => {
      const result = evaluateAmountBoundary(999, 1000);
      assert.ok(result);
      assert.equal(result.outcome, 'within');
      assert.equal(result.atLimit, false);
      assert.equal(result.over, false);
      assert.equal(result.delta, -1);
    });

    test('amount exactly at threshold is at_limit', () => {
      const result = evaluateAmountBoundary(1000, 1000);
      assert.ok(result);
      assert.equal(result.outcome, 'at_limit');
      assert.equal(result.atLimit, true);
      assert.equal(result.over, false);
      assert.equal(result.delta, 0);
    });

    test('amount above threshold is over', () => {
      const result = evaluateAmountBoundary(1001, 1000);
      assert.ok(result);
      assert.equal(result.outcome, 'over');
      assert.equal(result.atLimit, false);
      assert.equal(result.over, true);
      assert.equal(result.delta, 1);
    });

    test('zero amount against positive threshold is within', () => {
      const result = evaluateAmountBoundary(0, 1000);
      assert.ok(result);
      assert.equal(result.outcome, 'within');
      assert.equal(result.delta, -1000);
    });

    test('negative threshold classification', () => {
      const result = evaluateAmountBoundary(-5, -10);
      assert.ok(result);
      assert.equal(result.outcome, 'over');
      assert.equal(result.delta, 5);
    });

    test('non-finite amount returns null', () => {
      assert.equal(evaluateAmountBoundary(NaN, 1000), null);
      assert.equal(evaluateAmountBoundary(Infinity, 1000), null);
      assert.equal(evaluateAmountBoundary(-Infinity, 1000), null);
    });

    test('non-finite threshold returns null', () => {
      assert.equal(evaluateAmountBoundary(500, NaN), null);
      assert.equal(evaluateAmountBoundary(500, Infinity), null);
    });

    test('both non-finite returns null', () => {
      assert.equal(evaluateAmountBoundary(NaN, NaN), null);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Custom Stellar asset codes / wildcard asset rules
  // -------------------------------------------------------------------------
  describe('isStellarAssetCode — wildcard asset rules', () => {
    test('accepts native asset XLM', () => {
      assert.equal(isStellarAssetCode('XLM'), true);
    });

    test('accepts standard trustline asset codes', () => {
      assert.equal(isStellarAssetCode('USDC'), true);
      assert.equal(isStellarAssetCode('BTC'), true);
      assert.equal(isStellarAssetCode('ETH'), true);
      assert.equal(isStellarAssetCode('EURC'), true);
    });

    test('accepts short 1-character codes', () => {
      assert.equal(isStellarAssetCode('A'), true);
      assert.equal(isStellarAssetCode('0'), true);
    });

    test('accepts maximum 12-character codes', () => {
      assert.equal(isStellarAssetCode('ABCDEFGHIJKL'), true);
    });

    test('rejects 13-character codes (too long)', () => {
      assert.equal(isStellarAssetCode('ABCDEFGHIJKLM'), false);
    });

    test('rejects empty string', () => {
      assert.equal(isStellarAssetCode(''), false);
    });

    test('rejects lowercase codes', () => {
      assert.equal(isStellarAssetCode('usdc'), false);
      assert.equal(isStellarAssetCode('xlm'), false);
    });

    test('rejects codes with special characters', () => {
      assert.equal(isStellarAssetCode('USD-C'), false);
      assert.equal(isStellarAssetCode('US.DC'), false);
      assert.equal(isStellarAssetCode('US DC'), false);
      assert.equal(isStellarAssetCode('USD@C'), false);
    });

    test('rejects codes with spaces', () => {
      assert.equal(isStellarAssetCode('US DC'), false);
    });
  });

  describe('normalizeAssetCode — asset code normalization', () => {
    test('returns uppercase valid code', () => {
      assert.equal(normalizeAssetCode('usdc'), 'USDC');
      assert.equal(normalizeAssetCode('xlm'), 'XLM');
      assert.equal(normalizeAssetCode(' btc '), 'BTC');
    });

    test('returns null for invalid codes', () => {
      assert.equal(normalizeAssetCode(''), null);
      assert.equal(normalizeAssetCode('usd-c'), null);
      assert.equal(normalizeAssetCode('a'.repeat(13)), null);
      assert.equal(normalizeAssetCode('   '), null);
    });

    test('trims surrounding whitespace before validating', () => {
      assert.equal(normalizeAssetCode('  USDC  '), 'USDC');
      assert.equal(normalizeAssetCode('\tXLM\n'), 'XLM');
    });
  });

  describe('parseAssetOperationList — custom asset codes parsing', () => {
    test('parses a single valid operation record', () => {
      const result = parseAssetOperationList('payment,USDC,1500');
      assert.ok(result);
      assert.equal(result.length, 1);
      assert.equal(result[0]?.type, 'payment');
      assert.equal(result[0]?.asset, 'USDC');
      assert.equal(result[0]?.amount, '1500');
      assert.equal(result[0]?.source, 'manual input');
    });

    test('parses multiple semicolon-separated records', () => {
      const result = parseAssetOperationList('payment,USDC,1500;trade,XLM,2500;send,BTC,0.5');
      assert.ok(result);
      assert.equal(result.length, 3);
      assert.equal(result[0]?.asset, 'USDC');
      assert.equal(result[1]?.asset, 'XLM');
      assert.equal(result[2]?.asset, 'BTC');
    });

    test('parses records with optional source field', () => {
      const result = parseAssetOperationList('payment,USDC,1500,manual review');
      assert.ok(result);
      assert.equal(result[0]?.source, 'manualreview');
    });

    test('returns null for payload without commas (not operation list)', () => {
      assert.equal(parseAssetOperationList('AAAA'), null);
      assert.equal(parseAssetOperationList(''), null);
      assert.equal(parseAssetOperationList('   '), null);
      assert.equal(parseAssetOperationList('justtext'), null);
    });

    test('returns null for records with missing fields', () => {
      assert.equal(parseAssetOperationList('payment,USDC'), null);
      assert.equal(parseAssetOperationList('payment,'), null);
      assert.equal(parseAssetOperationList(','), null);
    });

    test('returns null for records with too many fields', () => {
      assert.equal(parseAssetOperationList('payment,USDC,1500,extra,field'), null);
    });

    test('returns null for invalid asset codes in records', () => {
      assert.equal(parseAssetOperationList('payment,usd-c,1500'), null);
      assert.equal(parseAssetOperationList('payment,,1500'), null);
    });

    test('returns null for negative amounts', () => {
      assert.equal(parseAssetOperationList('payment,USDC,-100'), null);
    });

    test('returns null for non-numeric amounts', () => {
      assert.equal(parseAssetOperationList('payment,USDC,abc'), null);
    });

    test('filters out empty records between semicolons', () => {
      const result = parseAssetOperationList('payment,USDC,1500;;trade,XLM,2500');
      assert.ok(result);
      assert.equal(result.length, 2);
    });

    test('normalizes whitespace in payload', () => {
      const result = parseAssetOperationList(' payment , USDC , 1500 ');
      assert.ok(result);
      assert.equal(result[0]?.type, 'payment');
      assert.equal(result[0]?.asset, 'USDC');
      assert.equal(result[0]?.amount, '1500');
    });

    test('accepts zero amount', () => {
      const result = parseAssetOperationList('payment,USDC,0');
      assert.ok(result);
      assert.equal(result[0]?.amount, '0');
    });
  });

  describe('isAssetAllowed — asset allowance check', () => {
    test('returns true when asset is in allow-list', () => {
      assert.equal(isAssetAllowed('USDC', ['XLM', 'USDC']), true);
      assert.equal(isAssetAllowed('XLM', ['XLM', 'USDC']), true);
    });

    test('returns false when asset is not in allow-list', () => {
      assert.equal(isAssetAllowed('BTC', ['XLM', 'USDC']), false);
      assert.equal(isAssetAllowed('ETH', ['USDC']), false);
    });

    test('returns false for empty allow-list', () => {
      assert.equal(isAssetAllowed('USDC', []), false);
    });

    test('is case-sensitive', () => {
      assert.equal(isAssetAllowed('usdc', ['USDC']), false);
      assert.equal(isAssetAllowed('USDC', ['usdc']), false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Fee-sufficiency / low-balance wallet depletion (evaluateFeeSufficiency)
  // -------------------------------------------------------------------------
  describe('evaluateFeeSufficiency — fee depletion edge cases', () => {
    test('returns sufficient when reserve covers one more fee', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 1000,
        transactionAmount: 500,
        networkFee: 100,
      });
      assert.ok(result);
      assert.equal(result.status, 'sufficient');
      assert.equal(result.remainingAfterTransaction, 400);
    });

    test('returns insufficient when amount + fee exceeds balance', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 100,
        transactionAmount: 200,
        networkFee: 50,
      });
      assert.ok(result);
      assert.equal(result.status, 'insufficient');
      assert.equal(result.remainingAfterTransaction, -150);
    });

    test('returns low when reserve is positive but below one fee', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 600,
        transactionAmount: 500,
        networkFee: 100,
      });
      assert.ok(result);
      assert.equal(result.status, 'low');
      assert.equal(result.remainingAfterTransaction, 0);
    });

    test('returns low when small positive reserve remains', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 650,
        transactionAmount: 500,
        networkFee: 100,
      });
      assert.ok(result);
      assert.equal(result.status, 'low');
      assert.equal(result.remainingAfterTransaction, 50);
    });

    test('zero balance with zero amount and zero fee is sufficient', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 0,
        transactionAmount: 0,
        networkFee: 0,
      });
      assert.ok(result);
      assert.equal(result.status, 'sufficient');
      assert.equal(result.remainingAfterTransaction, 0);
    });

    test('zero balance with positive amount is insufficient', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 0,
        transactionAmount: 100,
        networkFee: 10,
      });
      assert.ok(result);
      assert.equal(result.status, 'insufficient');
    });

    test('exact balance match (amount + fee = balance) is low', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 600,
        transactionAmount: 500,
        networkFee: 100,
      });
      assert.ok(result);
      assert.equal(result.status, 'low');
    });

    test('invalid on negative balance', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: -100,
        transactionAmount: 50,
        networkFee: 10,
      });
      assert.ok(result);
      assert.equal(result.status, 'invalid');
      assert.equal(Number.isNaN(result.remainingAfterTransaction), true);
    });

    test('invalid on negative transaction amount', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 1000,
        transactionAmount: -50,
        networkFee: 10,
      });
      assert.ok(result);
      assert.equal(result.status, 'invalid');
    });

    test('invalid on negative network fee', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: 1000,
        transactionAmount: 50,
        networkFee: -10,
      });
      assert.ok(result);
      assert.equal(result.status, 'invalid');
    });

    test('invalid on NaN inputs', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: NaN,
        transactionAmount: 50,
        networkFee: 10,
      });
      assert.ok(result);
      assert.equal(result.status, 'invalid');
    });

    test('invalid on Infinity inputs', () => {
      const result = evaluateFeeSufficiency({
        availableBalance: Infinity,
        transactionAmount: 50,
        networkFee: 10,
      });
      assert.ok(result);
      assert.equal(result.status, 'invalid');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Fee violation descriptors (describeFeeSufficiencyViolation)
  // -------------------------------------------------------------------------
  describe('describeFeeSufficiencyViolation — violation descriptors', () => {
    const makeResult = (status: FeeSufficiencyResult['status'], remaining: number): FeeSufficiencyResult => ({
      status,
      remainingAfterTransaction: remaining,
    });

    test('returns null for sufficient status', () => {
      assert.equal(
        describeFeeSufficiencyViolation(makeResult('sufficient', 500), 'stroops'),
        null,
      );
    });

    test('returns null for invalid status', () => {
      assert.equal(
        describeFeeSufficiencyViolation(makeResult('invalid', NaN), 'stroops'),
        null,
      );
    });

    test('returns danger severity for insufficient', () => {
      const info = describeFeeSufficiencyViolation(
        makeResult('insufficient', -150),
        'stroops',
      );
      assert.ok(info);
      assert.equal(info.severity, 'danger');
      assert.match(info.message, /insufficient balance for network fees/i);
      assert.match(info.message, /150 stroops/i);
    });

    test('returns warning severity for low', () => {
      const info = describeFeeSufficiencyViolation(
        makeResult('low', 50),
        'stroops',
      );
      assert.ok(info);
      assert.equal(info.severity, 'warning');
      assert.match(info.message, /less than one network fee of reserve/i);
    });

    test('uses custom unit label in message', () => {
      const info = describeFeeSufficiencyViolation(
        makeResult('insufficient', -10),
        'XLM',
      );
      assert.ok(info);
      assert.match(info.message, /10 XLM/i);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Fee risk badge descriptor (feeRiskBadgeDescriptor)
  // -------------------------------------------------------------------------
  describe('feeRiskBadgeDescriptor — badge descriptors', () => {
    const makeResult = (status: FeeSufficiencyResult['status'], remaining: number): FeeSufficiencyResult => ({
      status,
      remainingAfterTransaction: remaining,
    });

    test('returns danger descriptor for insufficient', () => {
      const badge = feeRiskBadgeDescriptor(makeResult('insufficient', -150));
      assert.ok(badge);
      assert.equal(badge.level, 'danger');
      assert.equal(badge.label, 'Balance below fees');
    });

    test('returns warning descriptor for low', () => {
      const badge = feeRiskBadgeDescriptor(makeResult('low', 50));
      assert.ok(badge);
      assert.equal(badge.level, 'warning');
      assert.equal(badge.label, 'Low fee reserve');
    });

    test('returns null for sufficient status', () => {
      assert.equal(feeRiskBadgeDescriptor(makeResult('sufficient', 500)), null);
    });

    test('returns null for invalid status', () => {
      assert.equal(feeRiskBadgeDescriptor(makeResult('invalid', NaN)), null);
    });
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateBalancesByAsset,
  BALANCE_DECIMALS,
  calculatePortfolioValue,
  convertToUsd,
  formatFixedPointUnits,
  getAssetKey,
  resolveRateUnits,
  toFixedPointUnits,
  type AssetBalanceEntry,
} from './balance-utils';

const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const OTHER_ISSUER = 'GBOTHERISSUERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

test('uses 8 decimal places', () => {
  assert.equal(BALANCE_DECIMALS, 8);
});

test('toFixedPointUnits parses numbers and decimal strings exactly', () => {
  assert.equal(toFixedPointUnits('1.23456789'), 123456789n);
  assert.equal(toFixedPointUnits(0.1), 10000000n);
  assert.equal(toFixedPointUnits('  42 '), 4200000000n);
  assert.equal(toFixedPointUnits('.5'), 50000000n);
  assert.equal(toFixedPointUnits('-2.5'), -250000000n);
  assert.equal(toFixedPointUnits(1e-7), 10n);
  assert.equal(toFixedPointUnits('1e-8'), 1n);
});

test('toFixedPointUnits rounds beyond 8 decimals half away from zero', () => {
  assert.equal(toFixedPointUnits('0.000000015'), 2n);
  assert.equal(toFixedPointUnits('0.000000014'), 1n);
  assert.equal(toFixedPointUnits('-0.000000015'), -2n);
});

test('toFixedPointUnits rejects invalid input without throwing', () => {
  for (const bad of ['', 'abc', '1.2.3', '.', '--1', Number.NaN, Infinity]) {
    assert.equal(toFixedPointUnits(bad), null, String(bad));
  }
});

test('formatFixedPointUnits renders exactly 8 decimal places', () => {
  assert.equal(formatFixedPointUnits(0n), '0.00000000');
  assert.equal(formatFixedPointUnits(1n), '0.00000001');
  assert.equal(formatFixedPointUnits(123456789n), '1.23456789');
  assert.equal(formatFixedPointUnits(-5n), '-0.00000005');
});

test('getAssetKey normalises code case and includes issuer when present', () => {
  assert.equal(getAssetKey({ code: 'xlm' }), 'XLM');
  assert.equal(
    getAssetKey({ code: 'usdc', issuer: USDC_ISSUER }),
    `USDC:${USDC_ISSUER}`,
  );
  assert.equal(getAssetKey({ code: 'XLM', issuer: '  ' }), 'XLM');
});

test('convertToUsd multiplies with 8-decimal precision', () => {
  assert.equal(convertToUsd('100', 0.12), '12.00000000');
  assert.equal(convertToUsd('0.00000001', '0.5'), '0.00000001');
  assert.equal(convertToUsd('0.00000001', '0.4'), '0.00000000');
  assert.equal(convertToUsd('12345678.12345678', '1'), '12345678.12345678');
});

test('convertToUsd returns null for missing or invalid rates', () => {
  assert.equal(convertToUsd('10', undefined), null);
  assert.equal(convertToUsd('10', -1), null);
  assert.equal(convertToUsd('10', Number.NaN), null);
  assert.equal(convertToUsd('oops', 1), null);
});

test('aggregateBalancesByAsset returns an empty list for no balances', () => {
  assert.deepEqual(aggregateBalancesByAsset([]), []);
});

test('aggregateBalancesByAsset sums the same asset exactly across wallets', () => {
  const result = aggregateBalancesByAsset([
    { code: 'XLM', amount: 0.1 },
    { code: 'xlm', amount: 0.2 },
    { code: 'USDC', issuer: USDC_ISSUER, amount: '10.5' },
  ]);

  assert.deepEqual(result, [
    {
      code: 'XLM',
      assetKey: 'XLM',
      amount: '0.30000000',
      amountValue: 0.3,
      entryCount: 2,
    },
    {
      code: 'USDC',
      issuer: USDC_ISSUER,
      assetKey: `USDC:${USDC_ISSUER}`,
      amount: '10.50000000',
      amountValue: 10.5,
      entryCount: 1,
    },
  ]);
});

test('aggregateBalancesByAsset keeps same code from different issuers separate', () => {
  const result = aggregateBalancesByAsset([
    { code: 'USDC', issuer: USDC_ISSUER, amount: 1 },
    { code: 'USDC', issuer: OTHER_ISSUER, amount: 2 },
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => item.amount),
    ['1.00000000', '2.00000000'],
  );
});

test('aggregateBalancesByAsset treats invalid amounts as zero and skips blank codes', () => {
  const result = aggregateBalancesByAsset([
    { code: 'XLM', amount: 'not-a-number' },
    { code: 'XLM', amount: Number.NaN },
    { code: 'XLM', amount: '5' },
    { code: '   ', amount: '100' },
  ]);

  assert.deepEqual(
    result.map(({ assetKey, amount, entryCount }) => ({
      assetKey,
      amount,
      entryCount,
    })),
    [{ assetKey: 'XLM', amount: '5.00000000', entryCount: 3 }],
  );
});

test('aggregateBalancesByAsset preserves extreme token decimals', () => {
  const result = aggregateBalancesByAsset([
    { code: 'DUST', amount: '0.00000001' },
    { code: 'DUST', amount: '0.00000002' },
    { code: 'WHALE', amount: '922337203685.47758070' },
    { code: 'WHALE', amount: '0.00000001' },
  ]);

  assert.equal(result[0]?.amount, '0.00000003');
  assert.equal(result[1]?.amount, '922337203685.47758071');
});

test('resolveRateUnits prefers issuer-qualified rates, then falls back to code', () => {
  const rates = { usdc: 1, [`USDC:${OTHER_ISSUER}`]: 0.98 };

  assert.equal(
    resolveRateUnits({ code: 'USDC', issuer: OTHER_ISSUER }, rates),
    98000000n,
  );
  assert.equal(
    resolveRateUnits({ code: 'USDC', issuer: USDC_ISSUER }, rates),
    100000000n,
  );
  assert.equal(resolveRateUnits({ code: 'XLM' }, rates), null);
});

test('calculatePortfolioValue values a multi-asset portfolio', () => {
  const balances: AssetBalanceEntry[] = [
    { code: 'XLM', amount: '1000' },
    { code: 'XLM', amount: '250.5' },
    { code: 'USDC', issuer: USDC_ISSUER, amount: '5000.12345678' },
    { code: 'AQUA', issuer: OTHER_ISSUER, amount: '1000000' },
  ];
  const result = calculatePortfolioValue(balances, {
    XLM: 0.11,
    USDC: 1,
    AQUA: '0.00071234',
  });

  assert.deepEqual(
    result.holdings.map(({ assetKey, amount, rateUsd, usdValue }) => ({
      assetKey,
      amount,
      rateUsd,
      usdValue,
    })),
    [
      {
        assetKey: 'XLM',
        amount: '1250.50000000',
        rateUsd: 0.11,
        usdValue: '137.55500000',
      },
      {
        assetKey: `USDC:${USDC_ISSUER}`,
        amount: '5000.12345678',
        rateUsd: 1,
        usdValue: '5000.12345678',
      },
      {
        assetKey: `AQUA:${OTHER_ISSUER}`,
        amount: '1000000.00000000',
        rateUsd: 0.00071234,
        usdValue: '712.34000000',
      },
    ],
  );
  assert.equal(result.totalUsd, '5850.01845678');
  assert.equal(result.totalUsdNumber, 5850.01845678);
  assert.deepEqual(result.unpricedAssets, []);
});

test('calculatePortfolioValue excludes assets with missing rates and reports them', () => {
  const result = calculatePortfolioValue(
    [
      { code: 'XLM', amount: '10' },
      { code: 'MYSTERY', issuer: OTHER_ISSUER, amount: '99' },
      { code: 'BADRATE', amount: '1' },
    ],
    { XLM: 0.1, BADRATE: -3 },
  );

  assert.equal(result.totalUsd, '1.00000000');
  assert.deepEqual(result.unpricedAssets, [`MYSTERY:${OTHER_ISSUER}`, 'BADRATE']);
  const mystery = result.holdings.find((holding) => holding.code === 'MYSTERY');
  assert.equal(mystery?.usdValue, null);
  assert.equal(mystery?.usdValueNumber, null);
  assert.equal(mystery?.rateUsd, null);
});

test('calculatePortfolioValue handles zero balances without flagging them unpriced', () => {
  const result = calculatePortfolioValue(
    [
      { code: 'XLM', amount: 0 },
      { code: 'UNKNOWN', amount: '0.00000000' },
    ],
    { XLM: 0.12 },
  );

  assert.equal(result.totalUsd, '0.00000000');
  assert.equal(result.totalUsdNumber, 0);
  assert.deepEqual(result.unpricedAssets, []);
  assert.equal(result.holdings[0]?.usdValue, '0.00000000');
});

test('calculatePortfolioValue returns a zero valuation for empty input', () => {
  assert.deepEqual(calculatePortfolioValue([], { XLM: 0.1 }), {
    totalUsd: '0.00000000',
    totalUsdNumber: 0,
    holdings: [],
    unpricedAssets: [],
  });
});

test('calculatePortfolioValue does not mutate its inputs', () => {
  const balances: AssetBalanceEntry[] = [{ code: 'xlm', amount: '1' }];
  const rates = { XLM: 0.1 };
  const snapshot = JSON.stringify({ balances, rates });

  calculatePortfolioValue(balances, rates);

  assert.equal(JSON.stringify({ balances, rates }), snapshot);
});

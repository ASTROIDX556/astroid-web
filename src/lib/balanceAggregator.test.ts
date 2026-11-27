import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateBalances,
  convertAssetToUsd,
  formatFiat,
  formatTokenAmount,
  normalizeAssetCode,
  normalizePriceFeed,
  parseBalanceAmount,
  balanceItemSchema,
  balancesArraySchema,
  type BalanceInput,
  type AssetRateQuote,
} from './balanceAggregator';

describe('normalizeAssetCode', () => {
  it('handles plain ticker symbols', () => {
    assert.equal(normalizeAssetCode('xlm'), 'XLM');
    assert.equal(normalizeAssetCode('USDC'), 'USDC');
    assert.equal(normalizeAssetCode(' aqua '), 'AQUA');
  });

  it('strips issuer address after colon', () => {
    assert.equal(
      normalizeAssetCode('USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'),
      'USDC',
    );
    assert.equal(
      normalizeAssetCode('yXLM:GARDNDAXRNWINGQg37ZWHF76TVN5J7V74P...'),
      'YXLM',
    );
  });
});

describe('parseBalanceAmount', () => {
  it('parses valid numbers and numeric strings', () => {
    assert.equal(parseBalanceAmount(100.5), 100.5);
    assert.equal(parseBalanceAmount('250.75'), 250.75);
    assert.equal(parseBalanceAmount(0), 0);
    assert.equal(parseBalanceAmount('0'), 0);
  });

  it('safely handles null, undefined, invalid and negative values', () => {
    assert.equal(parseBalanceAmount(null), 0);
    assert.equal(parseBalanceAmount(undefined), 0);
    assert.equal(parseBalanceAmount('invalid'), 0);
    assert.equal(parseBalanceAmount(-10), 0);
    assert.equal(parseBalanceAmount('-50.5'), 0);
  });
});

describe('convertAssetToUsd', () => {
  it('computes USD value using Stellar stroop precision (7 decimals)', () => {
    const usd = convertAssetToUsd(100, 0.125);
    assert.equal(usd, 12.5);
  });

  it('handles string amounts', () => {
    const usd = convertAssetToUsd('200.5', 1.0);
    assert.equal(usd, 200.5);
  });

  it('returns null when rate is missing, undefined, null, negative, or NaN', () => {
    assert.equal(convertAssetToUsd(100, null), null);
    assert.equal(convertAssetToUsd(100, undefined), null);
    assert.equal(convertAssetToUsd(100, -0.5), null);
    assert.equal(convertAssetToUsd(100, NaN), null);
  });

  it('returns 0 when rate is 0', () => {
    assert.equal(convertAssetToUsd(100, 0), 0);
  });
});

describe('formatFiat and formatTokenAmount', () => {
  it('formats fiat currency properly with default USD symbol', () => {
    assert.equal(formatFiat(1234.56), '$1,234.56');
    assert.equal(formatFiat(0), '$0.00');
    assert.equal(formatFiat(null), '—');
    assert.equal(formatFiat(undefined), '—');
    assert.equal(formatFiat(null, 'N/A'), 'N/A');
  });

  it('formats token amount with appropriate decimal limits', () => {
    assert.equal(formatTokenAmount(1234.5678, 'XLM'), '1,234.5678');
    assert.equal(formatTokenAmount(1234.5678, 'USDC'), '1,234.57');
  });
});

describe('normalizePriceFeed', () => {
  it('normalizes object record feed', () => {
    const feed = { XLM: 0.12, USDC: 1.0 };
    const map = normalizePriceFeed(feed);
    assert.equal(map.get('XLM'), 0.12);
    assert.equal(map.get('USDC'), 1.0);
  });

  it('normalizes array of AssetRateQuote objects', () => {
    const feed: AssetRateQuote[] = [
      { asset: 'XLM', priceUsd: 0.15 },
      { asset: 'USDC:GA5Z...', priceUsd: 1.0 },
    ];
    const map = normalizePriceFeed(feed);
    assert.equal(map.get('XLM'), 0.15);
    assert.equal(map.get('USDC'), 1.0);
  });

  it('normalizes Map instances', () => {
    const inputMap = new Map<string, number>([['XLM', 0.2]]);
    const map = normalizePriceFeed(inputMap);
    assert.equal(map.get('XLM'), 0.2);
  });

  it('handles null, undefined, or empty feeds gracefully', () => {
    assert.equal(normalizePriceFeed(null).size, 0);
    assert.equal(normalizePriceFeed(undefined).size, 0);
    assert.equal(normalizePriceFeed({}).size, 0);
  });
});

describe('balanceItemSchema validation', () => {
  it('validates valid balance objects', () => {
    assert.equal(balanceItemSchema.safeParse({ asset: 'XLM', balance: 100 }).success, true);
    assert.equal(balanceItemSchema.safeParse({ asset: 'USDC', amount: '50' }).success, true);
  });

  it('fails when asset is missing or both balance and amount are missing', () => {
    assert.equal(balanceItemSchema.safeParse({ balance: 100 }).success, false);
    assert.equal(balanceItemSchema.safeParse({ asset: 'XLM' }).success, false);
  });

  it('validates an array of balances with balancesArraySchema', () => {
    const valid = [
      { asset: 'XLM', balance: 50 },
      { asset: 'USDC', amount: 20 },
    ];
    assert.equal(balancesArraySchema.safeParse(valid).success, true);
  });
});

describe('aggregateBalances', () => {
  it('aggregates multiple balance items for the same asset code', () => {
    const balances: BalanceInput[] = [
      { asset: 'XLM', balance: 100 },
      { asset: 'XLM', balance: 250.5 },
      { asset: 'USDC', amount: '50' },
    ];
    const rates = { XLM: 0.12, USDC: 1.0 };

    const result = aggregateBalances(balances, rates);

    assert.equal(result.uniqueAssetCount, 2);
    assert.equal(result.totalItemsCount, 3);

    const xlm = result.byAsset['XLM'];
    assert(xlm);
    assert.equal(xlm.balance, 350.5);
    assert.equal(xlm.count, 2);
    assert.equal(xlm.usdRate, 0.12);
    assert.equal(xlm.usdValue, 42.06);

    const usdc = result.byAsset['USDC'];
    assert(usdc);
    assert.equal(usdc.balance, 50);
    assert.equal(usdc.usdValue, 50);

    assert.equal(result.totalUsdValue, 92.06);
    assert.equal(result.hasMissingRates, false);
    assert.equal(result.missingRateAssets.length, 0);
  });

  it('normalizes issued asset addresses to base ticker for grouping and pricing', () => {
    const balances: BalanceInput[] = [
      { asset: 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', balance: 100 },
      { asset: 'USDC', balance: 50 },
    ];
    const rates = { USDC: 1.0 };

    const result = aggregateBalances(balances, rates);

    assert.equal(result.uniqueAssetCount, 1);
    const usdc = result.byAsset['USDC'];
    assert(usdc);
    assert.equal(usdc.balance, 150);
    assert.equal(usdc.usdValue, 150);
    assert.equal(result.totalUsdValue, 150);
  });

  it('handles missing exchange rates gracefully without throwing or breaking total', () => {
    const balances: BalanceInput[] = [
      { asset: 'XLM', balance: 1000 },
      { asset: 'UNKNOWN_TOKEN', balance: 500 },
    ];
    const rates = { XLM: 0.1 };

    const result = aggregateBalances(balances, rates);

    assert.equal(result.hasMissingRates, true);
    assert.deepEqual(result.missingRateAssets, ['UNKNOWN_TOKEN']);

    const unknownToken = result.byAsset['UNKNOWN_TOKEN'];
    assert(unknownToken);
    assert.equal(unknownToken.usdRate, null);
    assert.equal(unknownToken.usdValue, null);
    assert.equal(unknownToken.usdValueFormatted, '—');
    assert.equal(unknownToken.hasMissingRate, true);
    assert.equal(unknownToken.allocationPercentage, null);

    // XLM is still calculated
    const xlm = result.byAsset['XLM'];
    assert(xlm);
    assert.equal(xlm.usdValue, 100);
    assert.equal(result.totalUsdValue, 100);
    assert.equal(result.totalUsdValueFormatted, '$100.00');
  });

  it('handles zero balances and respects includeZeroBalances option', () => {
    const balances: BalanceInput[] = [
      { asset: 'XLM', balance: 0 },
      { asset: 'USDC', balance: 100 },
    ];
    const rates = { XLM: 0.1, USDC: 1.0 };

    // Default: includeZeroBalances = true
    const resultWithZeros = aggregateBalances(balances, rates);
    assert.equal(resultWithZeros.uniqueAssetCount, 2);
    const xlmWithZero = resultWithZeros.byAsset['XLM'];
    assert(xlmWithZero);
    assert.equal(xlmWithZero.balance, 0);
    assert.equal(xlmWithZero.usdValue, 0);
    assert.equal(xlmWithZero.usdValueFormatted, '$0.00');
    assert.equal(resultWithZeros.hasMissingRates, false); // 0 balance missing rate is not flagged

    // Option: includeZeroBalances = false
    const resultNoZeros = aggregateBalances(balances, rates, { includeZeroBalances: false });
    assert.equal(resultNoZeros.uniqueAssetCount, 1);
    assert.equal(resultNoZeros.byAsset['XLM'], undefined);
    const usdcNoZero = resultNoZeros.byAsset['USDC'];
    assert(usdcNoZero);
    assert.equal(usdcNoZero.balance, 100);
  });

  it('calculates portfolio allocation percentages correctly', () => {
    const balances: BalanceInput[] = [
      { asset: 'XLM', balance: 1000 }, // 1000 * 0.1 = $100 (25%)
      { asset: 'USDC', balance: 300 },  // 300 * 1.0 = $300 (75%)
    ];
    const rates = { XLM: 0.1, USDC: 1.0 };

    const result = aggregateBalances(balances, rates);

    assert.equal(result.totalUsdValue, 400);
    const xlm = result.byAsset['XLM'];
    const usdc = result.byAsset['USDC'];
    assert(xlm);
    assert(usdc);
    assert.equal(xlm.allocationPercentage, 25);
    assert.equal(usdc.allocationPercentage, 75);
  });

  it('sorts aggregated assets according to sortBy option', () => {
    const balances: BalanceInput[] = [
      { asset: 'AAA', balance: 500 }, // $50
      { asset: 'BBB', balance: 100 }, // $200
      { asset: 'CCC', balance: 1000 }, // missing rate
    ];
    const rates = { AAA: 0.1, BBB: 2.0 };

    // Sort by usdDesc (default)
    const usdSorted = aggregateBalances(balances, rates, { sortBy: 'usdDesc' });
    assert.equal(usdSorted.assets[0]?.asset, 'BBB'); // $200
    assert.equal(usdSorted.assets[1]?.asset, 'AAA'); // $50
    assert.equal(usdSorted.assets[2]?.asset, 'CCC'); // null usd

    // Sort by balanceDesc
    const balSorted = aggregateBalances(balances, rates, { sortBy: 'balanceDesc' });
    assert.equal(balSorted.assets[0]?.asset, 'CCC'); // 1000
    assert.equal(balSorted.assets[1]?.asset, 'AAA'); // 500
    assert.equal(balSorted.assets[2]?.asset, 'BBB'); // 100

    // Sort by assetAsc
    const nameSorted = aggregateBalances(balances, rates, { sortBy: 'assetAsc' });
    assert.equal(nameSorted.assets[0]?.asset, 'AAA');
    assert.equal(nameSorted.assets[1]?.asset, 'BBB');
    assert.equal(nameSorted.assets[2]?.asset, 'CCC');
  });

  it('handles empty balances gracefully', () => {
    const result = aggregateBalances([]);
    assert.equal(result.totalUsdValue, 0);
    assert.equal(result.totalUsdValueFormatted, '$0.00');
    assert.equal(result.uniqueAssetCount, 0);
    assert.equal(result.totalItemsCount, 0);
    assert.deepEqual(result.assets, []);
    assert.deepEqual(result.missingRateAssets, []);
    assert.equal(result.hasMissingRates, false);
  });

  it('gracefully ignores invalid items when strictValidation is false (default)', () => {
    const balances = [
      null,
      undefined,
      'not-an-object',
      { invalid: 'structure' },
      { asset: 'XLM', balance: 100 },
    ];
    const rates = { XLM: 0.1 };

    const result = aggregateBalances(balances, rates);
    assert.equal(result.uniqueAssetCount, 1);
    assert.equal(result.totalItemsCount, 1);
    const xlm = result.byAsset['XLM'];
    assert(xlm);
    assert.equal(xlm.balance, 100);
  });

  it('throws an error on invalid item when strictValidation is true', () => {
    assert.throws(
      () => aggregateBalances('not-an-array', {}, { strictValidation: true }),
      /Input balances must be an array/,
    );

    assert.throws(
      () =>
        aggregateBalances(
          [{ asset: 'XLM' }], // missing balance and amount
          {},
          { strictValidation: true },
        ),
      /Invalid balance item/,
    );
  });
});

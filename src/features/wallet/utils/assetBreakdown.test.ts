import { describe, expect, it } from 'vitest';

import {
  classifyAsset,
  parseTrustlineBalances,
  totalHoldingsValue,
} from '@/features/wallet/utils/assetBreakdown';
import type { HorizonBalance } from '@/features/wallet/types';

const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const AGNT_ISSUER = 'GD7SJPBQDJINBHGWBANFC6QGN6QUEMIGRNXOMRZ3QL4D723BUML3FBIX';

const PRICES = { XLM: 0.1, USDC: 1, AGNT: 0.05 } as const;

const balances: HorizonBalance[] = [
  { balance: '1000.0000000', asset_type: 'native' },
  {
    balance: '500.0000000',
    asset_type: 'credit_alphanum4',
    asset_code: 'USDC',
    asset_issuer: USDC_ISSUER,
    limit: '10000.0000000',
    is_authorized: true,
  },
  {
    balance: '2000.0000000',
    asset_type: 'credit_alphanum4',
    asset_code: 'AGNT',
    asset_issuer: AGNT_ISSUER,
    is_authorized: false,
  },
];

describe('classifyAsset', () => {
  it('classifies the native asset, known codes, and unknown codes', () => {
    expect(classifyAsset('XLM', true)).toBe('native');
    expect(classifyAsset('USDC', false)).toBe('stablecoin');
    expect(classifyAsset('AGNT', false)).toBe('reward');
    expect(classifyAsset('WHATEVER', false)).toBe('custom');
  });

  it('treats fiat-prefixed codes as stablecoins by convention', () => {
    expect(classifyAsset('USDX', false)).toBe('stablecoin');
    expect(classifyAsset('yUSDC', false)).toBe('stablecoin');
    expect(classifyAsset('NGNT', false)).toBe('stablecoin');
  });
});

describe('parseTrustlineBalances', () => {
  it('parses amounts, issuers, limits, and authorization flags', () => {
    const holdings = parseTrustlineBalances(balances, PRICES);
    expect(holdings).toHaveLength(3);

    const [native, usdc, agnt] = holdings;
    expect(native?.code).toBe('XLM');
    expect(native?.issuer).toBeNull();
    expect(native?.amount).toBe(1000);
    expect(native?.usdValue).toBeCloseTo(100);
    expect(native?.limit).toBeNull();

    expect(usdc?.code).toBe('USDC');
    expect(usdc?.issuer).toBe(USDC_ISSUER);
    expect(usdc?.issuerVerified).toBe(true);
    expect(usdc?.limit).toBe(10000);
    expect(usdc?.authorized).toBe(true);

    expect(agnt?.authorized).toBe(false);
    expect(agnt?.limit).toBeNull();
  });

  it('puts the native asset first and ranks the rest by USD value', () => {
    const codes = parseTrustlineBalances(balances, PRICES).map((h) => h.code);
    // XLM ($100) first by rule; then USDC ($500) above AGNT ($100).
    expect(codes).toEqual(['XLM', 'USDC', 'AGNT']);
  });

  it('computes shares that sum to 100 when anything is priced', () => {
    const holdings = parseTrustlineBalances(balances, PRICES);
    const total = holdings.reduce((sum, h) => sum + h.share, 0);
    expect(total).toBeCloseTo(100);
    expect(totalHoldingsValue(holdings)).toBeCloseTo(700);
  });

  it('keeps unpriced assets visible at zero value', () => {
    const holdings = parseTrustlineBalances(balances, { USDC: 1 });
    const agnt = holdings.find((h) => h.code === 'AGNT');
    expect(agnt).toBeDefined();
    expect(agnt?.priceUsd).toBe(0);
    expect(agnt?.usdValue).toBe(0);
    expect(agnt?.share).toBe(0);
  });

  it('reports zero shares rather than NaN when nothing is priced', () => {
    const holdings = parseTrustlineBalances(balances, {});
    expect(holdings).toHaveLength(3);
    for (const holding of holdings) {
      expect(holding.share).toBe(0);
      expect(Number.isNaN(holding.share)).toBe(false);
    }
  });

  it('skips liquidity pool shares', () => {
    const holdings = parseTrustlineBalances(
      [
        ...balances,
        {
          balance: '42.0000000',
          asset_type: 'liquidity_pool_shares',
          liquidity_pool_id: 'abc123',
        },
      ],
      PRICES,
    );
    expect(holdings).toHaveLength(3);
  });

  it('skips credit entries missing a code or an unparseable amount', () => {
    const holdings = parseTrustlineBalances(
      [
        { balance: '10.0', asset_type: 'credit_alphanum4', asset_issuer: USDC_ISSUER },
        { balance: '', asset_type: 'native' },
        { balance: 'not-a-number', asset_type: 'native' },
        { balance: '  ', asset_type: 'credit_alphanum4', asset_code: 'USDC' },
      ],
      PRICES,
    );
    expect(holdings).toEqual([]);
  });

  it('flags an issuer key that fails checksum validation', () => {
    const holdings = parseTrustlineBalances(
      [
        {
          balance: '1.0',
          asset_type: 'credit_alphanum4',
          asset_code: 'BAD',
          asset_issuer: 'GNOTAVALIDSTELLARISSUERKEYATALLXXXXXXXXXXXXXXXXXXXXXXXXXX',
        },
      ],
      {},
    );
    expect(holdings[0]?.issuerVerified).toBe(false);
  });

  it('returns an empty array for null, undefined, and non-array input', () => {
    expect(parseTrustlineBalances(null)).toEqual([]);
    expect(parseTrustlineBalances(undefined)).toEqual([]);
    expect(parseTrustlineBalances([])).toEqual([]);
  });

  it('gives every holding a distinct id keyed by code and issuer', () => {
    const holdings = parseTrustlineBalances(
      [
        {
          balance: '1.0',
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          asset_issuer: USDC_ISSUER,
        },
        {
          balance: '2.0',
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          asset_issuer: AGNT_ISSUER,
        },
      ],
      PRICES,
    );
    const ids = holdings.map((h) => h.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toContain('USDC:');
  });
});

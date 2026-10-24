import type { HorizonBalance, StellarAsset } from './types';

/**
 * Preset list of well-known Stellar assets.
 * Issuer keys are real Stellar mainnet addresses for these tokens.
 */
export const presetAssets: StellarAsset[] = [
  {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JTH5UA4GHHQTUWQZ3XMY4Y2S3VHLW7A7I73ZMIFR67LMZ',
    name: 'USD Coin',
    verification: 'verified',
    trustline: 'trusted',
  },
  {
    code: 'EURC',
    issuer: 'GDQOE23C4MMKFZ25LZ5SE6Y56NYCJ7NKVP6YSO7HA7KJLJ7T6S5YEUU',
    name: 'Euro Coin',
    verification: 'verified',
    trustline: 'untrusted',
  },
  {
    code: 'yXLM',
    issuer: 'GALPCCUINT6MUDRN6PMKG6CLTEL3TE3KDEFSAU5T2RUEETE5Z5EMX25VP',
    name: 'yXLM (Superfluid)',
    verification: 'verified',
    trustline: 'untrusted',
  },
  {
    code: 'ARST',
    issuer: 'GBSTZN5OZTUIJ5ZG4N6XZSOPCJ5T765B5N7L4YELLGLO2ZBEDJWN7B1A',
    name: 'Arst',
    verification: 'verified',
    trustline: 'untrusted',
  },
  {
    code: 'BTC',
    issuer: 'GAUTUYYRTHMLUOVG7VZ7S5S7N3H3RE7V6Y3S3Z4J5Z2YX4QH4ZXXXX',
    name: 'Bitcoin on Stellar',
    verification: 'unverified',
    trustline: 'untrusted',
  },
  {
    code: 'ETH',
    issuer: 'GBVOLZ7F7Y7EVJZXEWZ3F6V3EODV4YU4GIOFAPJFHTJL4R7PKM3KJP7F',
    name: 'Ethereum on Stellar',
    verification: 'unverified',
    trustline: 'untrusted',
  },
  {
    code: 'SRT',
    issuer: 'GSSPDVH3SS66RCPPLJDCNLD4PC6S5KSJVYAJI7GPXGCQ7ESKC3STHT4A',
    name: 'Soroban token',
    verification: 'unverified',
    trustline: 'untrusted',
  },
];

/* -------------------------------------------------------------------------- */
/* Multi-currency balance breakdown                                            */
/* -------------------------------------------------------------------------- */

/**
 * Horizon-shaped account balances served when `NEXT_PUBLIC_API_URL` is unset,
 * so the breakdown widget renders a realistic treasury without a backend:
 * the native XLM position, two Circle stablecoins, an agent reward token, a
 * frozen trustline, a zero balance, and a liquidity pool share the parser
 * drops. Issuer keys are checksum-valid Stellar account ids.
 */
export const mockTrustlineBalances: HorizonBalance[] = [
  {
    balance: '482913.4821500',
    asset_type: 'native',
  },
  {
    balance: '128400.0000000',
    asset_type: 'credit_alphanum4',
    asset_code: 'USDC',
    asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    limit: '922337203685.4775807',
    is_authorized: true,
  },
  {
    balance: '41250.7500000',
    asset_type: 'credit_alphanum4',
    asset_code: 'EURC',
    asset_issuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
    limit: '500000.0000000',
    is_authorized: true,
  },
  {
    balance: '2750000.0000000',
    asset_type: 'credit_alphanum4',
    asset_code: 'AGNT',
    asset_issuer: 'GD7SJPBQDJINBHGWBANFC6QGN6QUEMIGRNXOMRZ3QL4D723BUML3FBIX',
    limit: '10000000.0000000',
    is_authorized: true,
  },
  {
    balance: '915000.0000000',
    asset_type: 'credit_alphanum4',
    asset_code: 'ASTR',
    asset_issuer: 'GDTAZQCRQAX4CNLBXLDAEG4KAMMW4G5OUBGMO3L5NSAW625BKVV5N4GQ',
    limit: '5000000.0000000',
    is_authorized: true,
  },
  {
    balance: '18420.0000000',
    asset_type: 'credit_alphanum4',
    asset_code: 'yXLM',
    asset_issuer: 'GCKFBEIYV2U22IO2BJ4KVJOIP7XPWQGQFKKWXR6DOSJBV7STMAQSMTGG',
    limit: '1000000.0000000',
    is_authorized: true,
  },
  {
    // Issuer froze this trustline — surfaced as a warning, not hidden.
    balance: '6500.0000000',
    asset_type: 'credit_alphanum12',
    asset_code: 'COMPUTE',
    asset_issuer: 'GDDZHDALU3WDGYRS7H6QZA6EVUK3OI2HEE3QK7POYO7PUCRLVDQ7SSIV',
    limit: '250000.0000000',
    is_authorized: false,
  },
  {
    balance: '0.0000000',
    asset_type: 'credit_alphanum4',
    asset_code: 'ARST',
    asset_issuer: 'GDJOTC5B5ZOJMSNY33BUB6ZWLTTXVU6CLB3EJLGWAL6L6O7RGP74F7XD',
    limit: '100000.0000000',
    is_authorized: true,
  },
  {
    // A pool participation rather than an asset holding — the parser skips it.
    balance: '1204.9100000',
    asset_type: 'liquidity_pool_shares',
    liquidity_pool_id:
      'dd7b1ab831c273310ddbec6f97870aa83c2fbd78ce22aded37ecbf4f3380fac7',
  },
];

/** Unit prices the breakdown uses in mock mode, keyed by asset code. */
export const mockAssetPricesUsd: Readonly<Record<string, number>> = {
  XLM: 0.1184,
  USDC: 1.0001,
  EURC: 1.0842,
  AGNT: 0.0392,
  ASTR: 0.0164,
  yXLM: 0.1157,
  COMPUTE: 0.4275,
  ARST: 0.00098,
};

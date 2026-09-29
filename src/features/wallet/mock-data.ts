import type { StellarAsset } from './types';

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

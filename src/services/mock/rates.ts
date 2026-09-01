import type { AssetRate } from '@/types/domain';

const now = new Date().toISOString();

export const assetRates: AssetRate[] = [
  {
    asset: 'XLM',
    priceUsd: 0.1184,
    change24h: 2.37,
    updatedAt: now,
    source: 'mock-stellar-dex',
  },
  {
    asset: 'USDC',
    priceUsd: 1.0001,
    change24h: -0.01,
    updatedAt: now,
    source: 'mock-circle',
  },
  {
    asset: 'yUSDF',
    priceUsd: 1.012,
    change24h: 0.42,
    updatedAt: now,
    source: 'mock-protocol',
  },
  {
    asset: 'AQUA',
    priceUsd: 0.00284,
    change24h: -4.15,
    updatedAt: now,
    source: 'mock-stellar-dex',
  },
];

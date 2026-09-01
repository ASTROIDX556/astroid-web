import type { AssetBalance, WalletSummary } from './types';

export const MOCK_ASSET_BALANCES: AssetBalance[] = [
  {
    id: 'ast-xlm',
    code: 'XLM',
    name: 'Stellar Lumens',
    balance: 12450.75,
    usdPrice: 0.12,
    decimals: 7,
  },
  {
    id: 'ast-usdc',
    code: 'USDC',
    name: 'USD Coin',
    balance: 8420.5,
    usdPrice: 1.0,
    issuer: 'GA5ZSEJ6B3AE8RGX3C古城L4PBRPSNY7HO6AZGEBTXOZMOI57DPMGBGI',
    decimals: 7,
  },
  {
    id: 'ast-eurc',
    code: 'EURC',
    name: 'Euro Coin',
    balance: 3200.0,
    usdPrice: 1.09,
    issuer: 'GAXLKZUT5RRPOOMN6HEB3TTSX5IREHBWMFT76Y2G4Q377E3VZE5BN2EQ',
    decimals: 7,
  },
  {
    id: 'ast-astro',
    code: 'ASTRO',
    name: 'Astroid Token',
    balance: 45000.0,
    usdPrice: 0.05,
    decimals: 7,
  },
];

export const MOCK_WALLET_SUMMARY: WalletSummary = {
  totalUsdValue: MOCK_ASSET_BALANCES.reduce(
    (sum, asset) => sum + asset.balance * asset.usdPrice,
    0,
  ),
  assets: MOCK_ASSET_BALANCES,
  lastUpdated: new Date().toISOString(),
};

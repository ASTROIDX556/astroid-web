export type AssetCode = 'XLM' | 'USDC' | 'EURC' | 'ASTRO';

export interface AssetBalance {
  id: string;
  code: AssetCode;
  name: string;
  balance: number;
  usdPrice: number;
  iconUrl?: string;
  issuer?: string;
  decimals: number;
}

export interface WalletSummary {
  totalUsdValue: number;
  assets: AssetBalance[];
  lastUpdated: string;
}

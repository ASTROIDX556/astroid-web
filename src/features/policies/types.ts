export type AssetSymbol = 'XLM' | 'USDC' | 'BTC' | 'ETH' | 'EURC';

export interface AssetRate {
  symbol: AssetSymbol;
  name: string;
  usdRate: number;
  decimals: number;
}

export interface BudgetLimitConfig {
  dailyLimitUsd: number;
  dailySpentUsd: number;
  singleTxCeilingUsd: number;
  networkBaseFeeXlm: number;
}

export interface SimulationResult {
  assetAmount: number;
  assetSymbol: AssetSymbol;
  amountUsd: number;
  networkFeeXlm: number;
  networkFeeUsd: number;
  totalCostUsd: number;
  currentSpentUsd: number;
  updatedSpentUsd: number;
  dailyLimitUsd: number;
  currentUtilizationPct: number;
  updatedUtilizationPct: number;
  exceedsSingleTxCeiling: boolean;
  exceedsDailyLimit: boolean;
  isPolicyViolation: boolean;
  warnings: string[];
}

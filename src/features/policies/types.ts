export type AssetSymbol = 'XLM' | 'USDC' | 'BTC' | 'ETH' | 'EURC';

export interface AssetRate {
  symbol: AssetSymbol;
  name: string;
  usdRate: number;
  decimals: number;
}

export const ASSET_RATES: Record<AssetSymbol, AssetRate> = {
  XLM: { symbol: 'XLM', name: 'Stellar Lumens', usdRate: 0.12, decimals: 7 },
  USDC: { symbol: 'USDC', name: 'USD Coin (Stellar)', usdRate: 1.0, decimals: 2 },
  BTC: { symbol: 'BTC', name: 'Bitcoin (Wrapped)', usdRate: 65000.0, decimals: 8 },
  ETH: { symbol: 'ETH', name: 'Ethereum (Wrapped)', usdRate: 3200.0, decimals: 8 },
  EURC: { symbol: 'EURC', name: 'Euro Coin', usdRate: 1.08, decimals: 2 },
};

export interface BudgetLimitConfig {
  dailyLimitUsd: number;
  dailySpentUsd: number;
  singleTxCeilingUsd: number;
  networkBaseFeeXlm: number;
}

export const DEFAULT_CONFIG: BudgetLimitConfig = {
  dailyLimitUsd: 10000,
  dailySpentUsd: 6800,
  singleTxCeilingUsd: 2500,
  networkBaseFeeXlm: 0.00001,
};

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

export interface PolicyRuleEvaluationLog {
  ruleId: string;
  ruleName: string;
  status: 'pass' | 'block';
  message: string;
  timestamp: string;
}

export interface PolicySimulationModalResult {
  success: boolean;
  summary: string;
  logs: PolicyRuleEvaluationLog[];
}

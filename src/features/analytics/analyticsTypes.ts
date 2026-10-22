/** Time buckets supported by the historical spend trend chart. */
export type SpendTrendInterval = 'weekly' | 'monthly';

/** One raw observation (for example, a day of agent spend). */
export interface SpendTrendPoint {
  /** ISO timestamp for the observation. */
  timestamp: string;
  /** Spend in the chart's asset units. */
  amount: number;
}

/** One aggregated point rendered by the area chart. */
export interface SpendTrendBucket {
  /** ISO timestamp at the start of the week or month. */
  timestamp: string;
  amount: number;
}

export interface SpendTrendDataset {
  interval: SpendTrendInterval;
  points: SpendTrendBucket[];
  total: number;
  asset: string;
}

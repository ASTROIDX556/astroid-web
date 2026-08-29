export type TransactionFailureReason =
  | 'tx_fee_too_small'
  | 'tx_bad_seq'
  | 'tx_insufficient_balance'
  | 'simulation_failed'
  | 'network_timeout';

export type GasFeeLevel = 'low' | 'medium' | 'priority';

export interface FailedTransaction {
  id: string;
  txHash: string;
  agentId: string;
  agentName: string;
  amount: number;
  asset: string;
  destination: string;
  failureReason: TransactionFailureReason;
  failureMessage: string;
  currentBaseFeeStroops: number;
  recommendedBaseFeeStroops: number;
  attemptedAt: string;
  xdrPayload: string;
}

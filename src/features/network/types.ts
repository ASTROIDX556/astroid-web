export type NetworkHealthStatus = 'healthy' | 'degraded' | 'outage';

export interface NetworkHealthData {
  status: NetworkHealthStatus;
  ledgerSequence: number;
  rpcLatencyMs: number;
  sorobanStatus: 'operational' | 'degraded' | 'down';
  horizonStatus: 'operational' | 'degraded' | 'down';
  networkName: string; // e.g., 'Stellar Testnet' | 'Stellar Mainnet'
  lastCheckedAt: string;
}

import type { SpendingCorrelationDataset } from './types';

export const MOCK_SPENDING_CORRELATION_DATA: SpendingCorrelationDataset = {
  timeframe: '30d',
  updatedAt: new Date().toISOString(),
  agents: [
    {
      id: 'agent-soroban',
      name: 'Soroban Relayer',
      category: 'Infrastructure',
    },
    {
      id: 'agent-ci',
      name: 'CI/CD Tester',
      category: 'Development',
    },
    {
      id: 'agent-liquidity',
      name: 'Liquidity Rebalancer',
      category: 'DeFi',
    },
    {
      id: 'agent-treasury',
      name: 'Treasury Guardian',
      category: 'Governance',
    },
    {
      id: 'agent-arbitrage',
      name: 'Yield Arbitrage Bot',
      category: 'DeFi',
    },
  ],
  matrix: [
    { agentIdA: 'agent-soroban', agentIdB: 'agent-soroban', coefficient: 1.0, sampleSize: 1420, commonTransactionsCount: 1420 },
    { agentIdA: 'agent-soroban', agentIdB: 'agent-ci', coefficient: 0.78, sampleSize: 1420, commonTransactionsCount: 310 },
    { agentIdA: 'agent-soroban', agentIdB: 'agent-liquidity', coefficient: 0.45, sampleSize: 1420, commonTransactionsCount: 185 },
    { agentIdA: 'agent-soroban', agentIdB: 'agent-treasury', coefficient: 0.12, sampleSize: 1420, commonTransactionsCount: 42 },
    { agentIdA: 'agent-soroban', agentIdB: 'agent-arbitrage', coefficient: 0.65, sampleSize: 1420, commonTransactionsCount: 215 },

    { agentIdA: 'agent-ci', agentIdB: 'agent-soroban', coefficient: 0.78, sampleSize: 980, commonTransactionsCount: 310 },
    { agentIdA: 'agent-ci', agentIdB: 'agent-ci', coefficient: 1.0, sampleSize: 980, commonTransactionsCount: 980 },
    { agentIdA: 'agent-ci', agentIdB: 'agent-liquidity', coefficient: 0.22, sampleSize: 980, commonTransactionsCount: 90 },
    { agentIdA: 'agent-ci', agentIdB: 'agent-treasury', coefficient: -0.05, sampleSize: 980, commonTransactionsCount: 12 },
    { agentIdA: 'agent-ci', agentIdB: 'agent-arbitrage', coefficient: 0.41, sampleSize: 980, commonTransactionsCount: 150 },

    { agentIdA: 'agent-liquidity', agentIdB: 'agent-soroban', coefficient: 0.45, sampleSize: 2100, commonTransactionsCount: 185 },
    { agentIdA: 'agent-liquidity', agentIdB: 'agent-ci', coefficient: 0.22, sampleSize: 2100, commonTransactionsCount: 90 },
    { agentIdA: 'agent-liquidity', agentIdB: 'agent-liquidity', coefficient: 1.0, sampleSize: 2100, commonTransactionsCount: 2100 },
    { agentIdA: 'agent-liquidity', agentIdB: 'agent-treasury', coefficient: 0.84, sampleSize: 2100, commonTransactionsCount: 890 },
    { agentIdA: 'agent-liquidity', agentIdB: 'agent-arbitrage', coefficient: 0.91, sampleSize: 2100, commonTransactionsCount: 1450 },

    { agentIdA: 'agent-treasury', agentIdB: 'agent-soroban', coefficient: 0.12, sampleSize: 640, commonTransactionsCount: 42 },
    { agentIdA: 'agent-treasury', agentIdB: 'agent-ci', coefficient: -0.05, sampleSize: 640, commonTransactionsCount: 12 },
    { agentIdA: 'agent-treasury', agentIdB: 'agent-liquidity', coefficient: 0.84, sampleSize: 640, commonTransactionsCount: 890 },
    { agentIdA: 'agent-treasury', agentIdB: 'agent-treasury', coefficient: 1.0, sampleSize: 640, commonTransactionsCount: 640 },
    { agentIdA: 'agent-treasury', agentIdB: 'agent-arbitrage', coefficient: 0.79, sampleSize: 640, commonTransactionsCount: 410 },

    { agentIdA: 'agent-arbitrage', agentIdB: 'agent-soroban', coefficient: 0.65, sampleSize: 1890, commonTransactionsCount: 215 },
    { agentIdA: 'agent-arbitrage', agentIdB: 'agent-ci', coefficient: 0.41, sampleSize: 1890, commonTransactionsCount: 150 },
    { agentIdA: 'agent-arbitrage', agentIdB: 'agent-liquidity', coefficient: 0.91, sampleSize: 1890, commonTransactionsCount: 1450 },
    { agentIdA: 'agent-arbitrage', agentIdB: 'agent-treasury', coefficient: 0.79, sampleSize: 1890, commonTransactionsCount: 410 },
    { agentIdA: 'agent-arbitrage', agentIdB: 'agent-arbitrage', coefficient: 1.0, sampleSize: 1890, commonTransactionsCount: 1890 },
  ],
};

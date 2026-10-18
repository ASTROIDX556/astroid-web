export interface AgentCorrelationNode {
  id: string;
  name: string;
  category: string;
}

export interface CorrelationCell {
  agentIdA: string;
  agentIdB: string;
  coefficient: number; // between -1.0 and 1.0
  sampleSize: number;
  commonTransactionsCount: number;
}

export interface SpendingCorrelationDataset {
  timeframe: '7d' | '30d' | '90d' | '1y';
  agents: AgentCorrelationNode[];
  matrix: CorrelationCell[];
  updatedAt: string;
}

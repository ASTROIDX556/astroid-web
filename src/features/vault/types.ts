export type CredentialType = 'api_key' | 'secret_key' | 'bearer_token' | 'webhook_secret';

export interface AgentCredential {
  id: string;
  name: string;
  type: CredentialType;
  service: string; // e.g., 'Horizon RPC', 'Nvidia NIM', 'OpenAI', 'CoinGecko'
  assignedAgentId: string;
  assignedAgentName: string;
  maskedValue: string;
  rawSecret?: string;
  createdAt: string;
  lastAccessedAt: string;
  lastRotatedAt: string;
  status: 'active' | 'rotated' | 'revoked';
}

export type AuditActionType = 'payment' | 'policy_check' | 'key_rotation' | 'model_invoke';

export interface AuditLogEntry {
  id: string;
  agentId: string;
  agentName: string;
  actionType: AuditActionType;
  status: 'success' | 'failed' | 'warning';
  cryptographicHash: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

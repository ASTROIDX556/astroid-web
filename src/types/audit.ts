export type AuditEventType =
  | 'action'
  | 'policy_change'
  | 'approval'
  | 'signature'
  | 'key_rotation'
  | 'budget_cap';

export type AuditLogLevel = 'info' | 'success' | 'warning' | 'error';

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  level: AuditLogLevel;
  actorId: string;
  actorName: string;
  actorType: 'agent' | 'user' | 'system';
  summary: string;
  details: string;
  project?: string;
  amount?: number;
  asset?: string;
  xdrHash?: string;
  rawPayload: Record<string, unknown>;
}

export type AuditTimeRange = 'all' | '24h' | '7d' | '30d';

export interface AuditFilters {
  searchQuery: string;
  eventType: AuditEventType | 'all';
  logLevel: AuditLogLevel | 'all';
  timeRange: AuditTimeRange;
  actorId: string | 'all';
}

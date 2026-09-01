export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  severity: AuditSeverity;
  actorId: string;
  actorName: string;
  actorType: 'agent' | 'user' | 'system';
  action: string;
  message: string;
  details: string;
  source: string;
}

export const MOCK_AUDIT_LOG_ENTRIES: AuditLogEntry[] = [
  {
    id: 'log-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    severity: 'info',
    actorId: 'agt-sweep-bot',
    actorName: 'Treasury Sweep Bot',
    actorType: 'agent',
    action: 'wallet.sweep',
    message: 'Completed automated XLM sweep across 3 wallets',
    details: 'Swept 12,500 XLM from dormant wallets to treasury. No policy violations detected.',
    source: 'sweep-service',
  },
  {
    id: 'log-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    severity: 'warning',
    actorId: 'agt-arb-runner',
    actorName: 'DEX Arbitrage Agent',
    actorType: 'agent',
    action: 'transaction.simulate',
    message: 'Transaction simulation failed: slippage tolerance exceeded',
    details: 'Swap path XLM->USDC->AQUA projected 3.2% slippage against 1.0% policy limit. Transaction halted.',
    source: 'defi-engine',
  },
  {
    id: 'log-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    severity: 'critical',
    actorId: 'usr-admin-alex',
    actorName: 'Alex Rivera',
    actorType: 'user',
    action: 'policy.override',
    message: 'Emergency policy override executed on budget cap',
    details: 'Admin bypassed monthly budget cap for Production Ops agent. Escalation reason: critical infrastructure payment required. Approval pending from secondary admin.',
    source: 'admin-console',
  },
  {
    id: 'log-004',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    severity: 'info',
    actorId: 'agt-sentinel',
    actorName: 'Security Sentinel',
    actorType: 'agent',
    action: 'key.rotate',
    message: 'API key rotation completed successfully',
    details: 'Horizon RPC endpoint credentials rotated. Previous key revoked. Zero-downtime transition confirmed.',
    source: 'vault-service',
  },
  {
    id: 'log-005',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    severity: 'warning',
    actorId: 'agt-nim-analyst',
    actorName: 'NIM Analyst',
    actorType: 'agent',
    action: 'budget.approach',
    message: 'Token allocation approaching ceiling (94% consumed)',
    details: '94,000 of 100,000 ASTRO tokens consumed this billing cycle. Auto-throttle will activate at 98%.',
    source: 'budget-monitor',
  },
  {
    id: 'log-006',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    severity: 'critical',
    actorId: 'agt-relayer',
    actorName: 'Soroban Relayer',
    actorType: 'agent',
    action: 'contract.invoke',
    message: 'Smart contract invocation reverted: unauthorized method call',
    details: 'Attempted to call restricted method execute_admin_transfer on contract CC3K...89FA. Caller agent lacks required capability.',
    source: 'soroban-gateway',
  },
  {
    id: 'log-007',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    severity: 'info',
    actorId: 'usr-finance-elena',
    actorName: 'Elena Rostova',
    actorType: 'user',
    action: 'approval.submit',
    message: 'Multi-sig disbursement request submitted',
    details: '50,000 XLM transfer request queued for dual-signature approval. 1 of 2 approvals received.',
    source: 'governance-ui',
  },
  {
    id: 'log-008',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    severity: 'warning',
    actorId: 'agt-compliance',
    actorName: 'Compliance Monitor',
    actorType: 'agent',
    action: 'policy.violation',
    message: 'Rate limit threshold triggered for outbound transfers',
    details: 'Agent attempted 12 transfers in 60 seconds. Policy rate_limit_01 enforces max 5 per minute. 7 requests queued.',
    source: 'policy-engine',
  },
  {
    id: 'log-009',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    severity: 'info',
    actorId: 'agt-memory-bot',
    actorName: 'Memory Consolidation Agent',
    actorType: 'agent',
    action: 'memory.consolidate',
    message: 'Daily memory consolidation completed',
    details: 'Processed 342 conversation fragments into 28 structured memory records. 0 conflicts detected.',
    source: 'memory-service',
  },
  {
    id: 'log-010',
    timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    severity: 'critical',
    actorId: 'usr-admin-alex',
    actorName: 'Alex Rivera',
    actorType: 'user',
    action: 'agent.suspend',
    message: 'Emergency agent suspension enacted',
    details: 'Agent agt-arb-runner suspended due to repeated policy violations. 3 critical violations in 24h window.',
    source: 'admin-console',
  },
];

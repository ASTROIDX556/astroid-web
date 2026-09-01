'use client';

import React, { useState, useMemo } from 'react';
import { AuditLogEntry } from '@/types/audit';

const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1',
    agentId: 'agent-stellar-treasury-01',
    agentName: 'Treasury Guardian',
    actionType: 'payment',
    status: 'success',
    cryptographicHash: '0x8f9c...3b21',
    timestamp: '2026-08-31T10:15:00Z',
    metadata: { recipient: 'GBC7...XYZ', amount: '500 XLM', asset: 'USDC', memo: 'Monthly contractor disbursement' },
  },
  {
    id: 'log-2',
    agentId: 'agent-risk-eval-04',
    agentName: 'Policy Sentinel',
    actionType: 'policy_check',
    status: 'warning',
    cryptographicHash: '0x4a12...9e88',
    timestamp: '2026-08-31T09:42:10Z',
    metadata: { ruleId: 'RULE-LIMIT-02', evaluatedLimit: '10,000 XLM', requestedValue: '12,500 XLM', verdict: 'flagged_for_review' },
  },
  {
    id: 'log-3',
    agentId: 'agent-key-manager-99',
    agentName: 'Auth Rotator',
    actionType: 'key_rotation',
    status: 'success',
    cryptographicHash: '0x1c34...ff09',
    timestamp: '2026-08-30T22:00:00Z',
    metadata: { keyId: 'KEY-ENV-PROD-02', provider: 'Nvidia NIM', reason: 'Scheduled rotation cycle' },
  },
];

export function AuditLogViewer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return MOCK_AUDIT_LOGS.filter((log) => {
      const matchesSearch = 
        log.agentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.cryptographicHash.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = selectedActionType === 'all' || log.actionType === selectedActionType;

      return matchesSearch && matchesType;
    });
  }, [searchQuery, selectedActionType]);

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <div className="w-full space-y-4 p-6 bg-slate-950 text-slate-100 rounded-lg border border-slate-800">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">AI Agent Audit Logs</h2>
          <p className="text-sm text-slate-400">Track immutable agent decisions, compliance records, and Stellar operations.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Search by Agent ID or Hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Search audit logs"
          />

          <select
            value={selectedActionType}
            onChange={(e) => setSelectedActionType(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Filter by action type"
          >
            <option value="all">All Actions</option>
            <option value="payment">Payment</option>
            <option value="policy_check">Policy Check</option>
            <option value="key_rotation">Key Rotation</option>
            <option value="model_invoke">Model Invoke</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-md">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3">Agent</th>
              <th className="p-3">Action Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Crypto Hash</th>
              <th className="p-3">Timestamp</th>
              <th className="p-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-500">
                  No matching audit records found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-3 font-medium">
                      <div>{log.agentName}</div>
                      <div className="text-xs text-slate-500 font-mono">{log.agentId}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-xs font-mono">
                        {log.actionType}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        log.status === 'success' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        log.status === 'warning' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-400">{log.cryptographicHash}</td>
                    <td className="p-3 text-slate-400 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => toggleRow(log.id)}
                        className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400"
                        aria-expanded={expandedRowId === log.id}
                        aria-label={`Toggle metadata for ${log.agentName}`}
                      >
                        {expandedRowId === log.id ? 'Hide JSON' : 'View JSON'}
                      </button>
                    </td>
                  </tr>
                  {expandedRowId === log.id && (
                    <tr className="bg-slate-900/80">
                      <td colSpan={6} className="p-4">
                        <div className="text-xs font-mono text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto">
                          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

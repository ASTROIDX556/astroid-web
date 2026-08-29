'use client';

import React, { useMemo, useState } from 'react';
import {
  Search,
  FileJson,
  FileSpreadsheet,
  Code,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Bot,
  User,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { formatCurrency, formatRelativeTime, formatDate } from '@/lib/format';
import { MOCK_AUDIT_EVENTS } from './mock-data';
import type { AuditEvent, AuditEventType, AuditLogLevel } from './types';

const LEVEL_ICONS: Record<AuditLogLevel, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-blue-400" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  error: <XCircle className="h-4 w-4 text-rose-400" />,
};

const LEVEL_BADGE_VARIANTS: Record<AuditLogLevel, 'info' | 'success' | 'warning' | 'danger'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

const EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  action: 'Agent Action',
  policy_change: 'Policy Change',
  approval: 'Governance Approval',
  signature: 'Transaction Signature',
  key_rotation: 'Key Rotation',
  budget_cap: 'Budget Cap',
};

export function AuditTimeline() {
  const [events] = useState<AuditEvent[]>(MOCK_AUDIT_EVENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('all');
  const [inspectEvent, setInspectEvent] = useState<AuditEvent | null>(null);

  // Filtered dataset
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Search query matching summary, details, or actor
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          evt.summary.toLowerCase().includes(q) ||
          evt.details.toLowerCase().includes(q) ||
          evt.actorName.toLowerCase().includes(q) ||
          evt.actorId.toLowerCase().includes(q) ||
          (evt.project && evt.project.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Event Type filter
      if (selectedEventType !== 'all' && evt.eventType !== selectedEventType) {
        return false;
      }

      // Log Level filter
      if (selectedLogLevel !== 'all' && evt.level !== selectedLogLevel) {
        return false;
      }

      // Time range filter
      if (selectedTimeRange !== 'all') {
        const now = Date.now();
        const evtTime = new Date(evt.timestamp).getTime();
        if (selectedTimeRange === '24h' && now - evtTime > 1000 * 60 * 60 * 24) return false;
        if (selectedTimeRange === '7d' && now - evtTime > 1000 * 60 * 60 * 24 * 7) return false;
        if (selectedTimeRange === '30d' && now - evtTime > 1000 * 60 * 60 * 24 * 30) return false;
      }

      return true;
    });
  }, [events, searchQuery, selectedEventType, selectedLogLevel, selectedTimeRange]);

  // Export JSON
  const handleExportJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredEvents, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `astroid-audit-timeline-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Level', 'Event Type', 'Actor', 'Summary', 'Details', 'Project', 'Amount', 'Asset'];
    const rows = filteredEvents.map((e) => [
      e.id,
      e.timestamp,
      e.level,
      e.eventType,
      `"${e.actorName} (${e.actorId})"`,
      `"${e.summary.replace(/"/g, '""')}"`,
      `"${e.details.replace(/"/g, '""')}"`,
      e.project || '',
      e.amount || '',
      e.asset || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `astroid-audit-timeline-${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search audit logs by actor, summary, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-button border border-border bg-surface pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-foreground-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Event Type Filter */}
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground font-medium focus:border-gold focus:outline-none"
          >
            <option value="all">All Event Types</option>
            <option value="action">Agent Action</option>
            <option value="policy_change">Policy Change</option>
            <option value="approval">Governance Approval</option>
            <option value="signature">Transaction Signature</option>
            <option value="key_rotation">Key Rotation</option>
            <option value="budget_cap">Budget Cap</option>
          </select>

          {/* Log Level Filter */}
          <select
            value={selectedLogLevel}
            onChange={(e) => setSelectedLogLevel(e.target.value)}
            className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground font-medium focus:border-gold focus:outline-none"
          >
            <option value="all">All Severity Levels</option>
            <option value="success">Success</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>

          {/* Date Range Filter */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground font-medium focus:border-gold focus:outline-none"
          >
            <option value="all">All Time</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 rounded-button border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground-secondary hover:border-gold hover:text-foreground transition-colors"
          >
            <FileJson className="h-3.5 w-3.5 text-gold" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-button border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground-secondary hover:border-gold hover:text-foreground transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Timeline Results Counter */}
      <div className="flex items-center justify-between text-xs text-foreground-muted">
        <span>Showing {filteredEvents.length} of {events.length} audit trail records</span>
      </div>

      {/* Timeline Stream View */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
        {filteredEvents.length === 0 ? (
          <Card className="p-8 text-center text-foreground-muted text-xs">
            No audit log records match the current filter criteria.
          </Card>
        ) : (
          filteredEvents.map((evt) => (
            <div key={evt.id} className="relative flex flex-col gap-2 group">
              {/* Timeline Indicator Dot */}
              <div className="absolute -left-6 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-surface border border-border group-hover:border-gold transition-colors">
                {LEVEL_ICONS[evt.level]}
              </div>

              {/* Event Card */}
              <Card interactive className="p-4 transition-all hover:border-border-strong">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={LEVEL_BADGE_VARIANTS[evt.level]} size="sm" className="uppercase font-mono">
                        {evt.level}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {EVENT_TYPE_LABELS[evt.eventType]}
                      </Badge>
                      {evt.project && (
                        <Badge variant="neutral" size="sm">
                          {evt.project}
                        </Badge>
                      )}
                      <span className="text-2xs text-foreground-muted ml-auto font-mono">
                        {formatRelativeTime(evt.timestamp)}
                      </span>
                    </div>

                    <h4 className="font-semibold text-foreground text-sm pt-1">{evt.summary}</h4>
                    <p className="text-xs text-foreground-secondary">{evt.details}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-2xs">
                  {/* Actor details */}
                  <div className="flex items-center gap-2">
                    {evt.actorType === 'agent' ? (
                      <Bot className="h-3.5 w-3.5 text-gold" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-blue-400" />
                    )}
                    <span className="font-medium text-foreground">{evt.actorName}</span>
                    <span className="font-mono text-foreground-muted">({evt.actorId})</span>
                  </div>

                  {/* Financial amount if present */}
                  {evt.amount && evt.asset && (
                    <div className="font-mono font-bold text-foreground bg-surface-secondary px-2 py-0.5 rounded-xs">
                      {formatCurrency(evt.amount, evt.asset)}
                    </div>
                  )}

                  {/* Payload inspector action */}
                  <button
                    type="button"
                    onClick={() => setInspectEvent(evt)}
                    className="flex items-center gap-1 text-gold hover:underline font-semibold"
                  >
                    <Code className="h-3 w-3" />
                    <span>Inspect Payload</span>
                  </button>
                </div>
              </Card>
            </div>
          ))
        )}
      </div>

      {/* Detailed Event Payload Modal */}
      {inspectEvent && (
        <Dialog
          open={Boolean(inspectEvent)}
          onClose={() => setInspectEvent(null)}
          title="Audit Event Payload & XDR Details"
          size="lg"
        >
          <div className="space-y-4 pt-2">
            <div className="grid gap-2 sm:grid-cols-2 text-xs bg-surface-secondary p-3 rounded-card border border-border">
              <div>
                <span className="text-foreground-muted">Event ID:</span>{' '}
                <span className="font-mono font-semibold text-foreground">{inspectEvent.id}</span>
              </div>
              <div>
                <span className="text-foreground-muted">Timestamp:</span>{' '}
                <span className="font-mono text-foreground">{formatDate(inspectEvent.timestamp)}</span>
              </div>
              <div>
                <span className="text-foreground-muted">Actor:</span>{' '}
                <span className="font-semibold text-foreground">{inspectEvent.actorName} ({inspectEvent.actorId})</span>
              </div>
              <div>
                <span className="text-foreground-muted">Event Type:</span>{' '}
                <span className="font-semibold text-foreground">{EVENT_TYPE_LABELS[inspectEvent.eventType]}</span>
              </div>
            </div>

            {inspectEvent.xdrHash && (
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-foreground-muted">
                  Stellar XDR Signature / Transaction Hash
                </label>
                <div className="font-mono text-2xs bg-surface p-2.5 rounded-button border border-border break-all text-gold">
                  {inspectEvent.xdrHash}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-2xs font-bold uppercase tracking-wider text-foreground-muted">
                Raw JSON Payload
              </label>
              <pre className="font-mono text-xs bg-surface-dark text-emerald-400 p-4 rounded-button overflow-x-auto max-h-72 border border-border">
                {JSON.stringify(inspectEvent.rawPayload, null, 2)}
              </pre>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

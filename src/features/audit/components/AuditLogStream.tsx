'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Search, X, AlertTriangle, Info, AlertOctagon, Bot, User, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { MOCK_AUDIT_LOG_ENTRIES } from '@/types/audit';
import type { AuditLogEntry, AuditSeverity } from '@/types/audit';

const SEVERITY_CONFIG: Record<
  AuditSeverity,
  { label: string; variant: 'info' | 'warning' | 'danger'; icon: React.ReactNode }
> = {
  info: {
    label: 'Info',
    variant: 'info',
    icon: <Info className="h-3.5 w-3.5" aria-hidden />,
  },
  warning: {
    label: 'Warning',
    variant: 'warning',
    icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
  },
  critical: {
    label: 'Critical',
    variant: 'danger',
    icon: <AlertOctagon className="h-3.5 w-3.5" aria-hidden />,
  },
};

const ACTOR_ICONS: Record<string, React.ReactNode> = {
  agent: <Bot className="h-3.5 w-3.5" aria-hidden />,
  user: <User className="h-3.5 w-3.5" aria-hidden />,
  system: <Shield className="h-3.5 w-3.5" aria-hidden />,
};

const SEVERITY_OPTIONS: AuditSeverity[] = ['info', 'warning', 'critical'];

export function AuditLogStream() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<AuditSeverity | 'all'>('all');

  const filteredEntries = useMemo(() => {
    return MOCK_AUDIT_LOG_ENTRIES.filter((entry) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          entry.message.toLowerCase().includes(q) ||
          entry.details.toLowerCase().includes(q) ||
          entry.actorName.toLowerCase().includes(q) ||
          entry.actorId.toLowerCase().includes(q) ||
          entry.action.toLowerCase().includes(q) ||
          entry.source.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (selectedSeverity !== 'all' && entry.severity !== selectedSeverity) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedSeverity]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleSeverityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedSeverity(e.target.value as AuditSeverity | 'all');
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape' && searchQuery) {
        handleClearSearch();
      }
    },
    [searchQuery, handleClearSearch],
  );

  return (
    <div className="space-y-4" role="region" aria-label="Agent Activity Audit Log Stream">
      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Input
            type="search"
            placeholder="Search logs by message, actor, action..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            leftIcon={<Search className="h-4 w-4" aria-hidden />}
            aria-label="Search audit log entries"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="severity-filter" className="text-xs font-medium text-foreground-secondary whitespace-nowrap">
            Severity:
          </label>
          <select
            id="severity-filter"
            value={selectedSeverity}
            onChange={handleSeverityChange}
            className="rounded-sm border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-border-strong"
            aria-label="Filter by severity level"
          >
            <option value="all">All Levels</option>
            {SEVERITY_OPTIONS.map((sev) => (
              <option key={sev} value={sev}>
                {SEVERITY_CONFIG[sev].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-foreground-muted" aria-live="polite">
        {filteredEntries.length} of {MOCK_AUDIT_LOG_ENTRIES.length} entries
      </div>

      {/* Log Stream */}
      <div
        className="relative space-y-1 pl-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-px before:bg-border"
        role="list"
        aria-label="Audit log entries"
      >
        {filteredEntries.length === 0 ? (
          <Card className="p-8 text-center text-foreground-muted text-xs" role="listitem">
            No audit log entries match the current filters.
          </Card>
        ) : (
          filteredEntries.map((entry) => (
            <LogEntryRow key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}

function LogEntryRow({ entry }: { entry: AuditLogEntry }) {
  const config = SEVERITY_CONFIG[entry.severity];

  return (
    <div
      className="relative flex flex-col gap-2 group"
      role="listitem"
      aria-label={`${config.label} severity log entry from ${entry.actorName}`}
    >
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute -left-6 top-2.5 h-2.5 w-2.5 rounded-full border-2 border-surface',
          entry.severity === 'info' && 'bg-info',
          entry.severity === 'warning' && 'bg-warning',
          entry.severity === 'critical' && 'bg-danger',
        )}
        aria-hidden
      />

      <Card className="p-3.5 transition-colors hover:border-border-strong">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <Badge variant={config.variant} size="sm" className="uppercase font-mono shrink-0">
              <span className="sr-only">Severity: </span>
              {config.icon}
              {config.label}
            </Badge>
            <span className="text-2xs font-mono text-foreground-muted truncate" title={entry.action}>
              {entry.action}
            </span>
            <span className="text-2xs text-foreground-muted hidden sm:inline">|</span>
            <span className="text-2xs font-mono text-foreground-muted truncate hidden sm:inline" title={entry.source}>
              {entry.source}
            </span>
          </div>
          <time
            dateTime={entry.timestamp}
            className="text-2xs font-mono text-foreground-muted whitespace-nowrap"
          >
            {formatRelativeTime(entry.timestamp)}
          </time>
        </div>

        <p className="mt-1.5 text-sm font-medium text-foreground leading-snug">{entry.message}</p>
        <p className="mt-1 text-xs text-foreground-secondary leading-relaxed">{entry.details}</p>

        <div className="mt-2.5 pt-2.5 border-t border-border/60 flex items-center gap-2 text-2xs">
          {ACTOR_ICONS[entry.actorType]}
          <span className="font-medium text-foreground">{entry.actorName}</span>
          <span className="font-mono text-foreground-muted">({entry.actorId})</span>
        </div>
      </Card>
    </div>
  );
}

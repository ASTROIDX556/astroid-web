'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
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
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatRelativeTime, formatDateTime } from '@/lib/format';
import { MOCK_AUDIT_EVENTS } from './mock-data';
import type { AuditEvent, AuditEventType, AuditLogLevel, AuditTimeRange } from './types';

const LEVEL_ICONS: Record<AuditLogLevel, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-info" aria-hidden />,
  success: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />,
  error: <XCircle className="h-4 w-4 text-danger" aria-hidden />,
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

const TIME_RANGE_LABELS: Record<AuditTimeRange, string> = {
  all: 'All Time',
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
};

function getTimeRangeCutoff(timeRange: AuditTimeRange): number | null {
  if (timeRange === 'all') return null;
  const now = Date.now();
  switch (timeRange) {
    case '24h':
      return now - 1000 * 60 * 60 * 24;
    case '7d':
      return now - 1000 * 60 * 60 * 24 * 7;
    case '30d':
      return now - 1000 * 60 * 60 * 24 * 30;
    default:
      return null;
  }
}

export function AuditTimeline() {
  const [events] = useState<AuditEvent[]>(MOCK_AUDIT_EVENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<AuditEventType | 'all'>('all');
  const [selectedLogLevel, setSelectedLogLevel] = useState<AuditLogLevel | 'all'>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<AuditTimeRange>('all');
  const [selectedActorId, setSelectedActorId] = useState<string>('all');
  const [inspectEvent, setInspectEvent] = useState<AuditEvent | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  const uniqueActors = useMemo(() => {
    const actorMap = new Map<string, string>();
    events.forEach((evt) => {
      if (!actorMap.has(evt.actorId)) {
        actorMap.set(evt.actorId, evt.actorName);
      }
    });
    return Array.from(actorMap.entries()).map(([id, name]) => ({ id, name }));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const cutoff = getTimeRangeCutoff(selectedTimeRange);
    return events.filter((evt) => {
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
      if (selectedEventType !== 'all' && evt.eventType !== selectedEventType) {
        return false;
      }
      if (selectedLogLevel !== 'all' && evt.level !== selectedLogLevel) {
        return false;
      }
      if (selectedActorId !== 'all' && evt.actorId !== selectedActorId) {
        return false;
      }
      if (cutoff !== null) {
        const evtTime = new Date(evt.timestamp).getTime();
        if (evtTime < cutoff) return false;
      }
      return true;
    });
  }, [events, searchQuery, selectedEventType, selectedLogLevel, selectedTimeRange, selectedActorId]);

  const handleExportJSON = useCallback(() => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(filteredEvents, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `astroid-audit-timeline-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [filteredEvents]);

  const handleExportCSV = useCallback(() => {
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
    URL.revokeObjectURL(url);
  }, [filteredEvents]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedEventType('all');
    setSelectedLogLevel('all');
    setSelectedTimeRange('all');
    setSelectedActorId('all');
  }, []);

  const hasActiveFilters = searchQuery !== '' || selectedEventType !== 'all' || selectedLogLevel !== 'all' || selectedTimeRange !== 'all' || selectedActorId !== 'all';

  const columns = useMemo<ColumnDef<AuditEvent, unknown>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: 'Timestamp',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-xs text-foreground font-medium">{formatDateTime(row.original.timestamp)}</span>
            <span className="text-2xs text-foreground-muted">{formatRelativeTime(row.original.timestamp)}</span>
          </div>
        ),
        sortingFn: 'datetime',
        meta: { className: 'min-w-[180px]' },
      },
      {
        accessorKey: 'level',
        header: 'Severity',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {LEVEL_ICONS[row.original.level]}
            <Badge variant={LEVEL_BADGE_VARIANTS[row.original.level]} size="sm" className="uppercase font-mono">
              {row.original.level}
            </Badge>
          </div>
        ),
        meta: { className: 'min-w-[120px]' },
      },
      {
        accessorKey: 'eventType',
        header: 'Event Type',
        cell: () => null,
        filterFn: (row, _columnId, filterValue) => {
          if (filterValue === 'all') return true;
          return row.original.eventType === filterValue;
        },
      },
      {
        id: 'eventTypeDisplay',
        header: 'Transaction Type',
        cell: ({ row }) => (
          <Badge variant="outline" size="sm">
            {EVENT_TYPE_LABELS[row.original.eventType]}
          </Badge>
        ),
        meta: { className: 'min-w-[160px]' },
      },
      {
        accessorKey: 'actorName',
        header: 'Actor',
        cell: ({ row }) => {
          const evt = row.original;
          return (
            <div className="flex items-center gap-2">
              {evt.actorType === 'agent' ? (
                <Bot className="h-3.5 w-3.5 text-gold" aria-hidden />
              ) : (
                <User className="h-3.5 w-3.5 text-info" aria-hidden />
              )}
              <div className="flex flex-col">
                <span className="text-xs text-foreground font-medium">{evt.actorName}</span>
                <span className="text-2xs text-foreground-muted font-mono">{evt.actorId}</span>
              </div>
            </div>
          );
        },
        meta: { className: 'min-w-[180px]' },
      },
      {
        accessorKey: 'summary',
        header: 'Summary',
        cell: ({ row }) => {
          const evt = row.original;
          return (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-foreground font-medium">{evt.summary}</span>
              <span className="text-xs text-foreground-secondary line-clamp-2">{evt.details}</span>
              {evt.project && (
                <Badge variant="neutral" size="sm" className="w-fit">
                  {evt.project}
                </Badge>
              )}
            </div>
          );
        },
        meta: { className: 'min-w-[280px]' },
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => {
          const evt = row.original;
          if (evt.amount && evt.asset) {
            return (
              <span className="font-mono font-bold text-foreground bg-surface-secondary px-2 py-0.5 rounded-xs text-xs">
                {formatCurrency(evt.amount, evt.asset)}
              </span>
            );
          }
          return <span className="text-foreground-muted">—</span>;
        },
        meta: { className: 'text-right min-w-[100px]' },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInspectEvent(row.original)}
            aria-label={`Inspect payload for event ${row.original.id}`}
            leftIcon={<Code className="h-3 w-3" aria-hidden />}
          >
            Inspect
          </Button>
        ),
        enableSorting: false,
        meta: { className: 'min-w-[100px]' },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredEvents,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualFiltering: true,
  });

  const pageCount = table.getPageCount();
  const canPaginate = pageCount > 1;

  return (
    <div className="space-y-6" role="region" aria-label="Agent Activity Audit Log Timeline">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Agent Activity Audit Log
          </h2>
          <p className="text-sm text-foreground-secondary mt-1">
            Chronological timeline of all agent actions with advanced filtering
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJSON}
            aria-label="Export audit log as JSON"
            leftIcon={<FileJson className="h-3.5 w-3.5 text-gold" aria-hidden />}
          >
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            aria-label="Export audit log as CSV"
            leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-success" aria-hidden />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3" role="search" aria-label="Audit log filters">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <label htmlFor="audit-search" className="sr-only">
              Search audit logs
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" aria-hidden />
            <input
              id="audit-search"
              type="search"
              placeholder="Search by actor, summary, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 rounded-button border border-border bg-surface pl-9 pr-8 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-foreground-muted" aria-hidden />
            <span className="text-xs text-foreground-secondary font-medium">Filters:</span>
          </div>

          <div className="relative">
            <label htmlFor="filter-event-type" className="sr-only">
              Filter by event type
            </label>
            <select
              id="filter-event-type"
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value as AuditEventType | 'all')}
              className="h-9 appearance-none rounded-button border border-border bg-surface pl-3 pr-8 py-1.5 text-sm text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="all">All Event Types</option>
              <option value="action">Agent Action</option>
              <option value="policy_change">Policy Change</option>
              <option value="approval">Governance Approval</option>
              <option value="signature">Transaction Signature</option>
              <option value="key_rotation">Key Rotation</option>
              <option value="budget_cap">Budget Cap</option>
            </select>
          </div>

          <div className="relative">
            <label htmlFor="filter-log-level" className="sr-only">
              Filter by severity level
            </label>
            <select
              id="filter-log-level"
              value={selectedLogLevel}
              onChange={(e) => setSelectedLogLevel(e.target.value as AuditLogLevel | 'all')}
              className="h-9 appearance-none rounded-button border border-border bg-surface pl-3 pr-8 py-1.5 text-sm text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="all">All Severity Levels</option>
              <option value="success">Success</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="relative">
            <label htmlFor="filter-actor" className="sr-only">
              Filter by agent
            </label>
            <select
              id="filter-actor"
              value={selectedActorId}
              onChange={(e) => setSelectedActorId(e.target.value)}
              className="h-9 appearance-none rounded-button border border-border bg-surface pl-3 pr-8 py-1.5 text-sm text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="all">All Agents</option>
              {uniqueActors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label htmlFor="filter-time-range" className="sr-only">
              Filter by date range
            </label>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Calendar className="h-3.5 w-3.5 text-foreground-muted" aria-hidden />
            </span>
            <select
              id="filter-time-range"
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as AuditTimeRange)}
              className="h-9 appearance-none rounded-button border border-border bg-surface pl-9 pr-8 py-1.5 text-sm text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {Object.entries(TIME_RANGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              aria-label="Clear all filters"
              leftIcon={<X className="h-3.5 w-3.5" aria-hidden />}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between text-sm text-foreground-muted" aria-live="polite" aria-atomic="true">
        <span>
          Showing {filteredEvents.length} of {events.length} audit trail records
        </span>
        {hasActiveFilters && (
          <span className="text-xs text-gold font-medium">
            Filters active
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-collapse text-left text-sm" role="grid" aria-label="Audit log timeline">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border bg-surface-secondary/40">
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as { className?: string } | undefined;
                    const canSort = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={`px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary ${meta?.className ?? ''}`}
                      >
                        {header.isPlaceholder ? null : (
                          <button
                            type="button"
                            onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                            disabled={!canSort}
                            className={`inline-flex items-center gap-1.5 text-left font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded ${!canSort ? 'cursor-default' : 'cursor-pointer'}`}
                            aria-label={canSort ? `Sort by ${header.column.columnDef.header?.toString()}, ${header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'unsorted'}` : undefined}
                            aria-sort={canSort ? (header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none') : undefined}
                          >
                            <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {canSort && (
                              <span aria-hidden className="text-foreground-muted">
                                {header.column.getIsSorted() === 'asc' ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : header.column.getIsSorted() === 'desc' ? (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5 opacity-50" />
                                )}
                              </span>
                            )}
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-border">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-8">
                    <div className="flex min-h-24 items-center justify-center text-sm text-foreground-secondary">
                      No audit log records match the current filter criteria.
                    </div>
                  </td>
                                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors duration-fast hover:bg-surface-secondary/30 focus-within:bg-surface-secondary/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`px-4 py-3 align-middle text-foreground ${(cell.column.columnDef.meta as { className?: string } | undefined)?.className ?? ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {canPaginate && (
          <div className="flex flex-col gap-3 border-t border-border bg-surface-secondary/20 px-4 py-3 text-sm text-foreground-secondary sm:flex-row sm:items-center sm:justify-between" role="navigation" aria-label="Audit log pagination">
            <p className="text-xs">
              Page {table.getState().pagination.pageIndex + 1} of {pageCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label="Go to first page"
              >
                First
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Go to previous page"
                leftIcon={<ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
              >
                Prev
              </Button>
              <span className="tabular-nums text-xs px-2" aria-live="polite">
                {table.getState().pagination.pageIndex + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Go to next page"
                rightIcon={<ChevronRight className="h-3.5 w-3.5" aria-hidden />}
              >
                Next
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={!table.getCanNextPage()}
                aria-label="Go to last page"
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </div>

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
                <span className="font-mono text-foreground">{formatDateTime(inspectEvent.timestamp)}</span>
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
                <label htmlFor="xdr-hash" className="text-2xs font-bold uppercase tracking-wider text-foreground-muted">
                  Stellar XDR Signature / Transaction Hash
                </label>
                <div id="xdr-hash" className="font-mono text-2xs bg-surface p-2.5 rounded-button border border-border break-all text-gold">
                  {inspectEvent.xdrHash}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="raw-payload" className="text-2xs font-bold uppercase tracking-wider text-foreground-muted">
                Raw JSON Payload
              </label>
              <pre
                id="raw-payload"
                className="font-mono text-xs bg-surface-secondary text-success p-4 rounded-button overflow-x-auto max-h-72 border border-border"
                tabIndex={0}
              >
                {JSON.stringify(inspectEvent.rawPayload, null, 2)}
              </pre>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default AuditTimeline;

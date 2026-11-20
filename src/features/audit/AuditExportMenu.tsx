'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuditEvent } from './types';

interface AuditExportMenuProps {
  events: AuditEvent[];
}

export function AuditExportMenu({ events }: AuditExportMenuProps) {
  const handleExportCsv = () => {
    if (events.length === 0) return;

    const headers = ['ID', 'Timestamp', 'Level', 'EventType', 'ActorId', 'ActorName', 'Summary', 'Details', 'Amount', 'Asset'];
    const rows = events.map((event) => [
      event.id,
      event.timestamp,
      event.level,
      event.eventType,
      event.actorId,
      `"${event.actorName.replace(/"/g, '""')}"`,
      `"${event.summary.replace(/"/g, '""')}"`,
      `"${event.details.replace(/"/g, '""')}"`,
      event.amount ?? '',
      event.asset ?? '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleExportCsv}
      disabled={events.length === 0}
      leftIcon={<Download className="h-3.5 w-3.5" aria-hidden />}
      aria-label="Export filtered audit logs to CSV"
    >
      Export CSV
    </Button>
  );
}

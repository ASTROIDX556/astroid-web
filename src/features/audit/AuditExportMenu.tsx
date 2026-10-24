'use client';

import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import { cn } from '@/lib/cn';
import { exportAuditEvents } from './export-utils';
import type { AuditEvent } from './types';

export interface AuditExportMenuProps {
  /** The currently visible (filtered) audit events to export. */
  events: readonly AuditEvent[];
  className?: string;
  label?: string;
}

/**
 * Export dropdown for the audit-log header.
 *
 * Exports exactly the rows the table is showing (filters, search, and time
 * range applied) as a CSV download with proper escaping or a pretty-printed
 * JSON file, both stamped with a timestamped filename.
 */
export function AuditExportMenu({ events, className, label = 'Export audit log' }: AuditExportMenuProps) {
  const disabled = events.length === 0;
  const countLabel = `${events.length} ${events.length === 1 ? 'event' : 'events'}`;

  const items: DropdownItem[] = [
    {
      label: `Download CSV (${countLabel})`,
      icon: <FileSpreadsheet className="h-3.5 w-3.5 text-success" aria-hidden />,
      disabled,
      onSelect: () => exportAuditEvents(events, 'csv'),
    },
    {
      label: `Download JSON (${countLabel})`,
      icon: <FileJson className="h-3.5 w-3.5 text-gold" aria-hidden />,
      disabled,
      onSelect: () => exportAuditEvents(events, 'json'),
    },
  ];

  return (
    <Dropdown
      align="end"
      aria-label={label}
      className={cn('min-w-[220px]', className)}
      triggerClassName={buttonVariants({ variant: 'outline', size: 'sm' })}
      trigger={
        <span className="inline-flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" aria-hidden />
          Export
        </span>
      }
      items={items}
    />
  );
}

export default AuditExportMenu;

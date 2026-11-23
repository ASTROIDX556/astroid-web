'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogExportMenu } from './LogExportMenu';
import { planAuditExport } from './export-utils';
import type { AuditEvent } from './types';
import { exportAuditEvents, type AuditExportFormat } from './export-utils';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';

interface AuditExportMenuProps {
  events: AuditEvent[];
}

export function AuditExportMenu({
  events,
  className,
  label = 'Export audit log',
}: AuditExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = (format: AuditExportFormat) => {
    if (events.length === 0) return;
    setIsExporting(true);
    try {
      exportAuditEvents(events, format);
    } finally {
      setIsExporting(false);
    }
  };

  const items: DropdownItem[] = [
    {
      label: 'Export as CSV',
      icon: <FileSpreadsheet className="h-4 w-4 text-success" aria-hidden />,
      onSelect: () => handleExport('csv'),
    },
    {
      label: 'Export as JSON',
      icon: <FileText className="h-4 w-4 text-info" aria-hidden />,
      onSelect: () => handleExport('json'),
    },
  ];
  return (
<LogExportMenu
      count={events.length}
      noun="event"
      aria-label="Export audit logs"
      className={className}
      disabled={events.length === 0 || isExporting}
      createPlan={(format) => planAuditExport(events, format)}
      items={items}
    />
  );
}

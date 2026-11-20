'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuditEvent } from './types';
import { exportAuditEvents, type AuditExportFormat } from './export-utils';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';

interface AuditExportMenuProps {
  events: AuditEvent[];
}

export function AuditExportMenu({ events }: AuditExportMenuProps) {
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
    <Dropdown
      align="end"
      aria-label="Export audit logs"
      trigger={(
        <Button
          variant="secondary"
          size="sm"
          disabled={events.length === 0 || isExporting}
          leftIcon={<Download className="h-3.5 w-3.5" aria-hidden />}
          aria-label="Export audit logs"
        >
          Export
        </Button>
      )}
      items={items}
    />
  );
}

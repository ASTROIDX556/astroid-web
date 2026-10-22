'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { DepartmentBudget } from './types';
import { MOCK_DEPARTMENT_BUDGETS } from './mock-data';
import {
  BUDGET_AUDIT_COLUMNS,
  BUDGET_LEDGER_COLUMNS,
  exportDataset,
  toBudgetAuditRows,
  toBudgetLedgerRows,
  type ExportFormat,
  type ExportResult,
} from './export';

/* -------------------------------------------------------------------------- */
/* Generic export dropdown                                                     */
/* -------------------------------------------------------------------------- */

export interface ExportAction {
  label: string;
  format: ExportFormat;
  /**
   * Serializes + downloads the dataset and returns its row count and file
   * name, or `null` when the dataset is empty (the menu then shows an
   * "nothing to export" toast instead of downloading a header-only file).
   */
  run: () => ExportResult | null;
}

export interface ExportMenuProps {
  actions: ExportAction[];
  /** Menu groups are separated after each index listed here. */
  separatorsAfter?: number[];
  triggerLabel?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * "Export" dropdown used by the budget tracking views: each item turns the
 * data currently rendered on screen into a downloadable CSV or JSON file and
 * reports the outcome through a `sonner` toast.
 */
export function ExportMenu({
  actions,
  separatorsAfter = [],
  triggerLabel = 'Export',
  ariaLabel = 'Export budget data',
  className,
}: ExportMenuProps) {
  const handleAction = (action: ExportAction) => {
    try {
      const result = action.run();
      if (!result) {
        toast.info('Nothing to export', {
          description: `There are no ${action.label.toLowerCase()} records in this view yet.`,
        });
        return;
      }
      toast.success(`${action.label} exported`, {
        description: `${result.rowCount} row${result.rowCount === 1 ? '' : 's'} saved as ${result.fileName}`,
      });
    } catch (error) {
      toast.error('Export failed', {
        description:
          error instanceof Error ? error.message : 'Unexpected error while generating the file.',
      });
    }
  };

  const items = useMemo<(DropdownItem | 'separator')[]>(() => {
    const entries: (DropdownItem | 'separator')[] = [];
    actions.forEach((action, index) => {
      const Icon = action.format === 'csv' ? FileSpreadsheet : FileJson;
      entries.push({
        label: action.label,
        icon: <Icon className="h-3.5 w-3.5" aria-hidden />,
        onSelect: () => handleAction(action),
      });
      if (separatorsAfter.includes(index)) entries.push('separator');
    });
    return entries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, separatorsAfter]);

  return (
    <Dropdown
      aria-label={ariaLabel}
      trigger={
        <>
          <Download className="h-4 w-4" aria-hidden />
          {triggerLabel}
        </>
      }
      triggerClassName={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'gap-2', className)}
      items={items}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Budgets overview wiring                                                     */
/* -------------------------------------------------------------------------- */

export interface BudgetExportMenuProps {
  departments?: readonly DepartmentBudget[];
  className?: string;
}

/**
 * Export menu for the department-level budget overview: the audit rows
 * (department × agent allocation state) and the flattened consumption log
 * (every ledger entry behind those allocations), each in CSV and JSON.
 */
export function BudgetExportMenu({
  departments = MOCK_DEPARTMENT_BUDGETS,
  className,
}: BudgetExportMenuProps) {
  const actions = useMemo<ExportAction[]>(
    () => [
      {
        label: 'Department audit (CSV)',
        format: 'csv',
        run: () => exportDataset(toBudgetAuditRows(departments), BUDGET_AUDIT_COLUMNS, 'csv', 'department-audit'),
      },
      {
        label: 'Department audit (JSON)',
        format: 'json',
        run: () => exportDataset(toBudgetAuditRows(departments), BUDGET_AUDIT_COLUMNS, 'json', 'department-audit'),
      },
      {
        label: 'Consumption log (CSV)',
        format: 'csv',
        run: () => exportDataset(toBudgetLedgerRows(departments), BUDGET_LEDGER_COLUMNS, 'csv', 'consumption-log'),
      },
      {
        label: 'Consumption log (JSON)',
        format: 'json',
        run: () => exportDataset(toBudgetLedgerRows(departments), BUDGET_LEDGER_COLUMNS, 'json', 'consumption-log'),
      },
    ],
    [departments],
  );

  return <ExportMenu actions={actions} separatorsAfter={[1]} className={className} />;
}

export default BudgetExportMenu;

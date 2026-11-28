/**
 * CSV/JSON export utilities for department budget allocations (#571).
 *
 * Organizations auditing agent expenditure need downloadable records of what
 * each department was allocated and what it has consumed. This module maps the
 * `DepartmentBudget` shape structurally (so `src/lib` keeps no dependency on a
 * feature folder) onto a flat, strictly typed record, then serializes it as
 * RFC 4180 CSV or a self-describing JSON envelope.
 *
 * Escaping and filename conventions are shared with `./exportSerialization`,
 * and the browser download is an SSR-safe no-op so the helpers can be imported
 * by server components and unit-tested under Node.
 */

import {
  EXPORT_MIME_TYPES,
  buildExportFilename,
  escapeCsvCell,
  type ExportFormat,
} from './exportSerialization';

export type { ExportFormat };

/** A flat, export-ready department budget allocation row. */
export interface DepartmentBudgetAllocationRecord {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  managerName: string;
  asset: string;
  period: string;
  allocated: number;
  spent: number;
  remaining: number;
  /** Spent as a percentage of allocated. 0 when nothing is allocated. */
  utilizationPercent: number;
  agentCount: number;
  updatedAt: string;
}

/**
 * Structural subset of `DepartmentBudget` this module reads. Every field beyond
 * the identifiers and totals is optional, so a partially hydrated budget still
 * produces a complete, aligned CSV row.
 */
export interface BudgetAllocationSource {
  id: string;
  departmentName: string;
  departmentCode?: string;
  managerName?: string;
  asset: string;
  period?: string;
  totalLimit: number;
  totalSpent: number;
  totalRemaining?: number;
  updatedAt?: string;
  agents?: readonly unknown[];
}

/** Record properties written to every export, in column order. */
export const BUDGET_ALLOCATION_COLUMNS = [
  'departmentId',
  'departmentName',
  'departmentCode',
  'managerName',
  'asset',
  'period',
  'allocated',
  'spent',
  'remaining',
  'utilizationPercent',
  'agentCount',
  'updatedAt',
] as const;

export type BudgetAllocationColumn = (typeof BUDGET_ALLOCATION_COLUMNS)[number];

/** Header casing for words that should stay upper-case, e.g. `ID` and `USDC`. */
const HEADER_ACRONYMS: Record<string, string> = {
  id: 'ID',
  csv: 'CSV',
  json: 'JSON',
  usd: 'USD',
  usdc: 'USDC',
  eurc: 'EURC',
  xlm: 'XLM',
  astro: 'ASTRO',
};

/**
 * Turns a record key into a human-readable column header:
 * `departmentId` → `Department ID`, `utilizationPercent` →
 * `Utilization Percent`, `total_usd` → `Total USD`.
 */
export function formatColumnHeader(column: string): string {
  return (
    column
      // Treat separators as word breaks before splitting camelCase.
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(
        (word) =>
          HEADER_ACRONYMS[word.toLowerCase()] ??
          `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
      )
      .join(' ') || 'Column'
  );
}

/** Column headers, in the same order as {@link BUDGET_ALLOCATION_COLUMNS}. */
export const BUDGET_ALLOCATION_HEADERS: readonly string[] =
  BUDGET_ALLOCATION_COLUMNS.map(formatColumnHeader);

const finiteOrZero = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Spent as a percentage of allocated, rounded to two decimals. */
function utilizationPercent(allocated: number, spent: number): number {
  if (allocated <= 0) return 0;
  return Math.round((spent / allocated) * 10_000) / 100;
}

/** Maps department budgets onto flat, export-ready records. */
export function toBudgetAllocationRecords(
  budgets: readonly BudgetAllocationSource[],
): DepartmentBudgetAllocationRecord[] {
  return budgets.map((budget) => {
    const allocated = finiteOrZero(budget.totalLimit);
    const spent = finiteOrZero(budget.totalSpent);
    const remaining = Number.isFinite(budget.totalRemaining)
      ? finiteOrZero(budget.totalRemaining)
      : allocated - spent;

    return {
      departmentId: budget.id,
      departmentName: budget.departmentName,
      departmentCode: budget.departmentCode ?? '',
      managerName: budget.managerName ?? '',
      asset: budget.asset,
      period: budget.period ?? '',
      allocated,
      spent,
      remaining,
      utilizationPercent: utilizationPercent(allocated, spent),
      agentCount: budget.agents?.length ?? 0,
      updatedAt: budget.updatedAt ?? '',
    };
  });
}

/**
 * Serializes allocation records as RFC 4180 CSV: a formatted header row, then
 * one CRLF-terminated row per record. An empty dataset yields the header row
 * alone, so the file still describes its schema.
 */
export function serializeBudgetAllocationsCsv(
  records: readonly DepartmentBudgetAllocationRecord[],
): string {
  const lines = [BUDGET_ALLOCATION_HEADERS.map(escapeCsvCell).join(',')];
  for (const record of records) {
    lines.push(
      BUDGET_ALLOCATION_COLUMNS.map((column) => escapeCsvCell(record[column])).join(
        ',',
      ),
    );
  }
  return lines.join('\r\n');
}

/** Self-describing JSON envelope written by the JSON export. */
export interface BudgetAllocationJsonEnvelope {
  exportedAt: string;
  recordType: 'department-budget-allocations';
  count: number;
  allocations: DepartmentBudgetAllocationRecord[];
}

/** Serializes allocation records as a pretty-printed JSON envelope. */
export function serializeBudgetAllocationsJson(
  records: readonly DepartmentBudgetAllocationRecord[],
  exportedAt: Date = new Date(),
): string {
  const envelope: BudgetAllocationJsonEnvelope = {
    exportedAt: exportedAt.toISOString(),
    recordType: 'department-budget-allocations',
    count: records.length,
    allocations: [...records],
  };
  return JSON.stringify(envelope, null, 2);
}

/** Serializes either format in one call. */
export function serializeBudgetAllocations(
  records: readonly DepartmentBudgetAllocationRecord[],
  format: ExportFormat,
  exportedAt: Date = new Date(),
): string {
  return format === 'csv'
    ? serializeBudgetAllocationsCsv(records)
    : serializeBudgetAllocationsJson(records, exportedAt);
}

/** `astroid-department-budget-allocations-<timestamp>.csv|json`. */
export function buildBudgetAllocationFilename(
  format: ExportFormat,
  exportedAt: Date = new Date(),
): string {
  return buildExportFilename('department-budget-allocations', format, exportedAt);
}

/** Outcome of a dashboard export, suitable for a toast or status message. */
export interface BudgetExportResult {
  rowCount: number;
  fileName: string;
  format: ExportFormat;
}

function triggerDownload(content: string, mimeType: string, fileName: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // A UTF-8 BOM helps Excel and friends detect the encoding of CSV files.
  const parts: BlobPart[] = mimeType.startsWith('text/csv')
    ? ['\uFEFF', content]
    : [content];
  const blob = new Blob(parts, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Downloads the records in `format` and reports what was written. Returns
 * `null` for an empty dataset so the caller can show a "nothing to export"
 * message instead of downloading a header-only file. Outside the browser the
 * serialization still runs but the download is a no-op.
 */
export function downloadBudgetAllocations(
  records: readonly DepartmentBudgetAllocationRecord[],
  format: ExportFormat,
  exportedAt: Date = new Date(),
): BudgetExportResult | null {
  if (records.length === 0) return null;

  const fileName = buildBudgetAllocationFilename(format, exportedAt);
  triggerDownload(
    serializeBudgetAllocations(records, format, exportedAt),
    EXPORT_MIME_TYPES[format],
    fileName,
  );
  return { rowCount: records.length, fileName, format };
}

/** Maps + downloads budget allocations in one call, for dashboard toolbars. */
export function exportDepartmentBudgetAllocations(
  budgets: readonly BudgetAllocationSource[],
  format: ExportFormat,
  exportedAt: Date = new Date(),
): BudgetExportResult | null {
  return downloadBudgetAllocations(
    toBudgetAllocationRecords(budgets),
    format,
    exportedAt,
  );
}

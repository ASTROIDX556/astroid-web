/**
 * Self-contained export helpers for the department budget views (#167).
 *
 * Kept inside `src/features/budgets/` on purpose: it has no dependency on any
 * shared export module, so it compiles against `main` regardless of other
 * in-flight PRs. Serializing is split from the browser plumbing so both can be
 * exercised outside a DOM (see the tsc-emit harness described in the PR).
 */
import type { DepartmentBudget } from './types';

export type ExportFormat = 'csv' | 'json';

export const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv;charset=utf-8;',
  json: 'application/json;charset=utf-8;',
};

export interface ExportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number;
}

export type ExportRow = Record<string, string | number>;

/* -------------------------------------------------------------------------- */
/* Rows                                                                        */
/* -------------------------------------------------------------------------- */

export function projectRows<T>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
): ExportRow[] {
  return rows.map((row) => {
    const projected: ExportRow = {};
    for (const column of columns) projected[column.key] = column.value(row);
    return projected;
  });
}

/* -------------------------------------------------------------------------- */
/* CSV                                                                         */
/* -------------------------------------------------------------------------- */

export const CSV_DELIMITER = ',';
export const CSV_LINE_BREAK = '\r\n';

/** RFC 4180 quoting: wrap when the value carries a delimiter, quote or break. */
export function escapeCsvValue(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * CSV for `rows`, using the declaration order of `columns` for both the header
 * line and every data line. Object key order is not relied upon, so a partially
 * filled row never shifts a column out of alignment.
 */
export function toCsv(
  rows: readonly ExportRow[],
  columns: readonly { key: string; header: string }[],
): string {
  const lines = [
    columns.map((column) => escapeCsvValue(column.header)).join(CSV_DELIMITER),
  ];
  for (const row of rows) {
    lines.push(
      columns.map((column) => escapeCsvValue(row[column.key] ?? '')).join(CSV_DELIMITER),
    );
  }
  return lines.join(CSV_LINE_BREAK);
}

/* -------------------------------------------------------------------------- */
/* JSON                                                                        */
/* -------------------------------------------------------------------------- */

export function toJson(rows: readonly ExportRow[]): string {
  return JSON.stringify(rows, null, 2);
}

/* -------------------------------------------------------------------------- */
/* Downloading                                                                 */
/* -------------------------------------------------------------------------- */

/** `astroid-budgets-<scope>-20261018T144450Z.csv` — safe, sortable, collision-free. */
export function buildExportFileName(
  scope: string,
  format: ExportFormat,
  stamp: Date = new Date(),
): string {
  const slug =
    scope
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'export';
  const suffix = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return `astroid-budgets-${slug}-${suffix}.${format}`;
}

/**
 * Client-side download via a transient object URL. The URL is revoked on the
 * next macrotask — Safari keeps a synchronous revoke from dropping the blob
 * before the navigation is queued.
 */
export function downloadTextFile(
  content: string,
  format: ExportFormat,
  fileName: string,
): void {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return;
  const url = URL.createObjectURL(new Blob([content], { type: MIME_TYPES[format] }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* -------------------------------------------------------------------------- */
/* Department budget audit rows                                                */
/* -------------------------------------------------------------------------- */

/** One department × agent pair, with the ledger entry count and last activity. */
export interface BudgetAuditRow {
  department: string;
  departmentCode: string;
  manager: string;
  agent: string;
  agentId: string;
  asset: string;
  allocated: number;
  spent: number;
  remaining: number;
  ledgerEntries: number;
  lastActivity: string;
}

export const BUDGET_AUDIT_COLUMNS: ExportColumn<BudgetAuditRow>[] = [
  { key: 'department', header: 'Department', value: (r) => r.department },
  { key: 'departmentCode', header: 'Department code', value: (r) => r.departmentCode },
  { key: 'manager', header: 'Manager', value: (r) => r.manager },
  { key: 'agent', header: 'Agent', value: (r) => r.agent },
  { key: 'agentId', header: 'Agent ID', value: (r) => r.agentId },
  { key: 'asset', header: 'Asset', value: (r) => r.asset },
  { key: 'allocated', header: 'Allocated', value: (r) => r.allocated },
  { key: 'spent', header: 'Spent', value: (r) => r.spent },
  { key: 'remaining', header: 'Remaining', value: (r) => r.remaining },
  { key: 'ledgerEntries', header: 'Ledger entries', value: (r) => r.ledgerEntries },
  { key: 'lastActivity', header: 'Last activity', value: (r) => r.lastActivity },
];

export function toBudgetAuditRows(
  departments: readonly DepartmentBudget[],
): BudgetAuditRow[] {
  const rows: BudgetAuditRow[] = [];
  for (const department of departments) {
    for (const agent of department.agents) {
      rows.push({
        department: department.departmentName,
        departmentCode: department.departmentCode,
        manager: department.managerName,
        agent: agent.agentName,
        agentId: agent.agentId,
        asset: agent.asset,
        allocated: agent.allocatedAmount,
        spent: agent.spentAmount,
        remaining: agent.remainingAmount,
        ledgerEntries: agent.ledger?.length ?? 0,
        lastActivity: agent.lastTransactionAt,
      });
    }
  }
  return rows;
}

/** Flat consumption log — every ledger entry of every agent in scope. */
export interface BudgetLedgerRow {
  department: string;
  agent: string;
  entryId: string;
  date: string;
  description: string;
  counterparty: string;
  amount: number;
  asset: string;
}

export const BUDGET_LEDGER_COLUMNS: ExportColumn<BudgetLedgerRow>[] = [
  { key: 'department', header: 'Department', value: (r) => r.department },
  { key: 'agent', header: 'Agent', value: (r) => r.agent },
  { key: 'entryId', header: 'Entry ID', value: (r) => r.entryId },
  { key: 'date', header: 'Date', value: (r) => r.date },
  { key: 'description', header: 'Description', value: (r) => r.description },
  { key: 'counterparty', header: 'Counterparty', value: (r) => r.counterparty },
  { key: 'amount', header: 'Amount', value: (r) => r.amount },
  { key: 'asset', header: 'Asset', value: (r) => r.asset },
];

export function toBudgetLedgerRows(
  departments: readonly DepartmentBudget[],
): BudgetLedgerRow[] {
  const rows: BudgetLedgerRow[] = [];
  for (const department of departments) {
    for (const agent of department.agents) {
      for (const entry of agent.ledger ?? []) {
        rows.push({
          department: department.departmentName,
          agent: agent.agentName,
          entryId: entry.id,
          date: entry.date,
          description: entry.description,
          counterparty: entry.counterparty,
          amount: entry.amount,
          asset: agent.asset,
        });
      }
    }
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/* One-call convenience                                                        */
/* -------------------------------------------------------------------------- */

export interface ExportResult {
  rowCount: number;
  fileName: string;
}

/**
 * Serialize + download in one step. Returns `null` for an empty dataset so the
 * caller can surface the "nothing to export" toast instead of writing a header
 * only file.
 */
export function exportDataset<T>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
  format: ExportFormat,
  scope: string,
): ExportResult | null {
  if (rows.length === 0) return null;
  const projected = projectRows(rows, columns);
  const content = format === 'csv' ? toCsv(projected, columns) : toJson(projected);
  const fileName = buildExportFileName(scope, format);
  downloadTextFile(content, format, fileName);
  return { rowCount: projected.length, fileName };
}

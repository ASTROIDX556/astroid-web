/**
 * Utility functions for exporting agent financial reports (CSV / JSON).
 * All operations are client-side only — no server calls, mock-mode compatible.
 */

export interface ColumnDefinition<T extends object = Record<string, unknown>> {
  key: keyof T & string;
  label: string;
}

export type ColumnSpec<T extends object = Record<string, unknown>> =
  | (keyof T & string)
  | ColumnDefinition<T>;

/**
 * Filter dataset by date range (inclusive).
 * Supports ISO strings, YYYY-MM-DD strings, or Date instances.
 * Falls back to common date field names if dateField is not provided.
 */
export function filterByDateRange<T extends object>(
  data: T[],
  start?: string | Date | null,
  end?: string | Date | null,
  dateField?: keyof T & string
): T[] {
  if (!data || !Array.isArray(data)) return [];

  // Handle YYYY-MM-DD start date → 00:00:00.000Z
  let startTimestamp: number | null = null;
  if (start) {
    if (typeof start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
      startTimestamp = new Date(`${start}T00:00:00.000Z`).getTime();
    } else {
      startTimestamp = new Date(start).getTime();
    }
    if (isNaN(startTimestamp)) startTimestamp = null;
  }

  // Handle YYYY-MM-DD end date → 23:59:59.999Z
  let endTimestamp: number | null = null;
  if (end) {
    if (typeof end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
      endTimestamp = new Date(`${end}T23:59:59.999Z`).getTime();
    } else {
      endTimestamp = new Date(end).getTime();
    }
    if (isNaN(endTimestamp)) endTimestamp = null;
  }

  return data.filter((item) => {
    if (!item) return false;

    let fieldVal: unknown;
    if (dateField && item[dateField] !== undefined) {
      fieldVal = item[dateField];
    } else {
      const obj = item as Record<string, unknown>;
      fieldVal =
        obj['createdAt'] ??
        obj['updatedAt'] ??
        obj['timestamp'] ??
        obj['resetsAt'] ??
        obj['lastTransactionAt'];
    }

    if (fieldVal === undefined || fieldVal === null) return true;

    const itemMs = new Date(fieldVal as string).getTime();
    if (isNaN(itemMs)) return true;

    if (startTimestamp !== null && itemMs < startTimestamp) return false;
    if (endTimestamp !== null && itemMs > endTimestamp) return false;

    return true;
  });
}

/**
 * Converts array of data objects to CSV string using selected columns.
 */
export function toCSV<T extends object>(
  data: T[],
  selectedColumns: ColumnSpec<T>[]
): string {
  if (!selectedColumns || selectedColumns.length === 0) return '';

  const columns = resolveColumns(selectedColumns);
  const header = columns.map((col) => escapeCSV(col.label)).join(',');

  if (!data || data.length === 0) return header;

  const rows = data.map((item) => {
    const obj = item as Record<string, unknown>;
    return columns.map((col) => escapeCSV(formatValue(obj[col.key]))).join(',');
  });

  return [header, ...rows].join('\r\n');
}

/**
 * Converts array of data objects to pretty-printed JSON string using selected columns.
 */
export function toJSON<T extends object>(
  data: T[],
  selectedColumns?: ColumnSpec<T>[]
): string {
  if (!data) return '[]';

  if (!selectedColumns || selectedColumns.length === 0) {
    return JSON.stringify(data, null, 2);
  }

  const columns = resolveColumns(selectedColumns);
  const exportData = data.map((item) => {
    const obj = item as Record<string, unknown>;
    const row: Record<string, unknown> = {};
    columns.forEach((col) => {
      row[col.key] = obj[col.key];
    });
    return row;
  });

  return JSON.stringify(exportData, null, 2);
}

/**
 * Triggers a client-side browser file download.
 */
export function triggerDownload(
  content: string,
  filename: string,
  mimeType = 'text/csv;charset=utf-8;'
): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

// ── helpers ─────────────────────────────────────────────────────────────────

function resolveColumns<T extends object>(
  cols: ColumnSpec<T>[]
): ColumnDefinition<T>[] {
  return cols.map((col) =>
    typeof col === 'string' ? ({ key: col, label: col } as unknown as ColumnDefinition<T>) : col
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function escapeCSV(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

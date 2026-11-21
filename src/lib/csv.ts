/** Shared CSV primitives — RFC 4180 quoting plus spreadsheet-safe text cells. */

export type CsvCell = string | number | boolean | Date | null | undefined;
export type CsvValue = CsvCell;

export interface CsvColumn<TData> {
  header: string;
  value: (row: TData) => CsvCell;
}

/** Leading characters spreadsheet apps can interpret as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Quotes a single field, doubles embedded quotes and prefixes text that could
 * be imported as a spreadsheet formula with an apostrophe. Numbers and booleans
 * keep their native representation so amounts remain numeric in spreadsheets.
 */
function escapeCsvCell(value: CsvCell): string {
  if (value instanceof Date) return `"${value.toISOString()}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return `"${value}"`;

  const text = value == null ? '' : String(value);
  const safeText = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function serializeCsv<TData>(
  rows: readonly TData[],
  columns: readonly CsvColumn<TData>[],
): string {
  const records = [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => column.value(row))),
  ];

  return records
    .map((record) => record.map(escapeCsvCell).join(','))
    .join('\r\n');
}

export function downloadCsv<TData>(
  rows: readonly TData[],
  columns: readonly CsvColumn<TData>[],
  filename: string,
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const blob = new Blob([serializeCsv(rows, columns)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

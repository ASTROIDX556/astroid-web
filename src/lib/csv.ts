/**
 * Shared client-side CSV helpers.
 *
 * Single source of truth for turning tabular rows into a standards-compliant
 * CSV file and triggering a browser download — no backend dependency. Amounts
 * are emitted as raw numeric text (no `$`, no thousands separators) so they
 * import as numbers in Excel/Sheets, and any field containing a comma, quote,
 * or newline is quoted and escaped per RFC 4180.
 *
 * If you need CSV export elsewhere in the app (ledger data, budget tables,
 * audit logs), import these helpers instead of writing another Blob download.
 */

/** Values accepted in a CSV cell. `null`/`undefined` render as empty fields. */
export type CsvValue = string | number | boolean | null | undefined;

export interface CsvInput<T extends Record<string, unknown>> {
  /** Column order: header labels keyed by the field they read from each row. */
  columns: { header: string; accessor: (row: T) => CsvValue }[];
  /** Row data to serialize. */
  rows: T[];
}

/** Escape one field per RFC 4180: quote when it contains `,` `"` CR or LF. */
export function escapeCsvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Serialize header labels + row cells into a CRLF-delimited CSV document. */
export function serializeCsv(headers: string[], rows: CsvValue[][]): string {
  const line = (fields: CsvValue[]) => fields.map(escapeCsvField).join(',');
  return [line(headers), ...rows.map(line)].join('\r\n');
}

/** Map typed rows to CSV text using the declared column order. */
export function csvFromRows<T extends Record<string, unknown>>({ columns, rows }: CsvInput<T>): string {
  return serializeCsv(
    columns.map((column) => column.header),
    rows.map((row) => columns.map((column) => column.accessor(row))),
  );
}

export interface DownloadCsvOptions {
  /** Suggested filename; `.csv` is appended when missing. */
  filename: string;
  /** Full CSV document text, e.g. from {@link serializeCsv} or {@link csvFromRows}. */
  content: string;
}

/**
 * Download a CSV string as a file via Blob + object URL. A UTF-8 BOM is
 * prepended so spreadsheet applications detect the encoding correctly.
 * Safe to call only in the browser; no-ops during SSR.
 */
export function downloadCsv({ filename, content }: DownloadCsvOptions): void {
  if (typeof document === 'undefined') return;

  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

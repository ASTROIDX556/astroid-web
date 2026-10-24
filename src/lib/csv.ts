export type CsvCell = string | number | boolean | null | undefined;

export interface CsvColumn<TData> {
  header: string;
  value: (row: TData) => CsvCell;
}

function escapeCsvCell(value: CsvCell): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
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
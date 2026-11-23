type CsvValue = string | number | boolean | Date | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

function serializeValue(value: CsvValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})/.test(text)
    ? new Date(text).toISOString()
    : text;
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function serializeCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const records = [
    columns.map((column) => escapeCsv(column.header)).join(','),
    ...rows.map((row) =>
      columns.map((column) => escapeCsv(serializeValue(column.value(row)))).join(','),
    ),
  ];
  return `\uFEFF${records.join('\r\n')}`;
}

export function downloadCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  filename: string,
): void {
  const blob = new Blob([serializeCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
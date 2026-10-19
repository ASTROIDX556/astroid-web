import type { AuditEvent } from './types';

/**
 * Client-side audit-log export helpers.
 *
 * Everything here runs in the browser against the currently visible table
 * data (respecting active filters), so compliance officers can export exactly
 * what they are looking at. CSV generation follows RFC 4180 escaping and JSON
 * output is pretty-printed with an `exportedAt` envelope.
 */

export type AuditExportFormat = 'csv' | 'json';

export interface AuditExportPayload {
  filename: string;
  mimeType: string;
  content: string;
}

/** Column order for the CSV export; mirrors the audit table at full fidelity. */
const CSV_HEADERS = [
  'Event ID',
  'Timestamp',
  'Level',
  'Event Type',
  'Actor ID',
  'Actor Name',
  'Actor Type',
  'Project',
  'Amount',
  'Asset',
  'Summary',
  'Details',
  'XDR Hash',
  'Raw Payload',
] as const;

/**
 * Escape a single CSV field per RFC 4180: values containing commas, quotes, or
 * line breaks are wrapped in double quotes and embedded quotes are doubled.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);
  if (text.length === 0) return '';
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build the full CSV document (header row + one line per event). */
export function buildAuditCsv(events: readonly AuditEvent[]): string {
  const rows = events.map((event) =>
    [
      event.id,
      event.timestamp,
      event.level,
      event.eventType,
      event.actorId,
      event.actorName,
      event.actorType,
      event.project ?? '',
      event.amount ?? '',
      event.asset ?? '',
      event.summary,
      event.details,
      event.xdrHash ?? '',
      event.rawPayload,
    ]
      .map(escapeCsvField)
      .join(','),
  );
  return [CSV_HEADERS.map(escapeCsvField).join(','), ...rows].join('\r\n');
}

/** Build the pretty-printed JSON document with export metadata. */
export function buildAuditJson(events: readonly AuditEvent[], exportedAt: Date = new Date()): string {
  return JSON.stringify(
    {
      exportedAt: exportedAt.toISOString(),
      count: events.length,
      events,
    },
    null,
    2,
  );
}

/**
 * Descriptive, filesystem-safe filename stamped with the export time, e.g.
 * `astroid-audit-log-2026-10-19T12-34-56-789Z.csv`.
 */
export function buildAuditExportFilename(
  format: AuditExportFormat,
  date: Date = new Date(),
): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `astroid-audit-log-${stamp}.${format}`;
}

/** Assemble a complete export payload (filename, mime type, serialized body). */
export function buildAuditExport(
  events: readonly AuditEvent[],
  format: AuditExportFormat,
  date: Date = new Date(),
): AuditExportPayload {
  return format === 'csv'
    ? {
        filename: buildAuditExportFilename('csv', date),
        mimeType: 'text/csv;charset=utf-8;',
        content: buildAuditCsv(events),
      }
    : {
        filename: buildAuditExportFilename('json', date),
        mimeType: 'application/json;charset=utf-8;',
        content: buildAuditJson(events, date),
      };
}

/** Trigger a browser file download for an export payload (client-side only). */
export function downloadAuditExport(payload: AuditExportPayload): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([payload.content], { type: payload.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = payload.filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Convenience: build and download the audit log in one call. */
export function exportAuditEvents(
  events: readonly AuditEvent[],
  format: AuditExportFormat,
  date: Date = new Date(),
): void {
  downloadAuditExport(buildAuditExport(events, format, date));
}

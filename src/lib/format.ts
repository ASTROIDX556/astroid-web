/** Formatting helpers — money, numbers, dates, hashes. */

const currencyPrefix: Record<string, string> = {
  USD: '$',
  USDC: '$',
  XLM: '',
};

/** Format a monetary amount with its asset. USD/USDC render with a `$` prefix. */
export function formatCurrency(
  amount: number,
  asset = 'USDC',
  options: { compact?: boolean; decimals?: number } = {},
): string {
  const { compact = false, decimals } = options;
  const prefix = currencyPrefix[asset] ?? '';
  const suffix = prefix === '' ? ` ${asset}` : '';

  const value = compact
    ? new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(amount)
    : new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals ?? (Number.isInteger(amount) ? 0 : 2),
        maximumFractionDigits: decimals ?? 2,
      }).format(amount);

  return `${prefix}${value}${suffix}`;
}

export function formatDashboardCurrency(
  amount: number,
  currency: 'USD' | 'USDC',
  options: { compact?: boolean; decimals?: number } = {},
): string {
  const formatted = formatCurrency(amount, 'USD', options);
  return currency === 'USDC' ? `${formatted} USDC` : formatted;
}

/** Compact integer/decimal formatting: 1,284 / 12.9K / 4.2M. */
export function formatNumber(value: number, compact = false): string {
  return new Intl.NumberFormat('en-US', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);
}

/** Format a percentage from a 0..100 value. */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/** Truncate a Stellar address or hash: `GABC…WXYZ`. */
export function truncateHash(value: string, lead = 4, tail = 4): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** Human-readable relative time: "2h ago", "just now", "3d ago". */
export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 45) return 'just now';
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
    [2592000, 'month'],
    [31536000, 'year'],
  ];
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  let unitSeconds = 1;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [threshold, u] of units) {
    if (abs < threshold) break;
    unitSeconds = threshold;
    unit = u;
  }
  return rtf.format(-Math.round(diffSec / unitSeconds), unit);
}

/** Format an absolute date: "Jul 31, 2026". */
export function formatDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** Format date + time: "Jul 31, 2026 · 14:05". */
export function formatDateTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return `${formatDate(date)} · ${new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)}`;
}

/** Initials from a name, max two characters. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

import type {
  SpendTrendBucket,
  SpendTrendInterval,
  SpendTrendPoint,
} from './analyticsTypes';

/** Pure aggregation helpers for the historical spend trend chart. */

const DAY_MS = 24 * 60 * 60 * 1000;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Monday 00:00 UTC for the week containing `timestamp`. */
function startOfUtcWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysSinceMonday,
  );
}

/** First day of the month at 00:00 UTC. */
function startOfUtcMonth(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export function spendTrendBucketStart(
  timestamp: number,
  interval: SpendTrendInterval,
): number {
  return interval === 'weekly' ? startOfUtcWeek(timestamp) : startOfUtcMonth(timestamp);
}

/**
 * Sum observations into weekly (Monday-start) or monthly buckets. Invalid
 * timestamps and non-finite amounts are ignored so a malformed API row cannot
 * poison the whole series.
 */
export function aggregateSpendTrend(
  points: SpendTrendPoint[],
  interval: SpendTrendInterval,
): SpendTrendBucket[] {
  const totals = new Map<number, number>();

  for (const point of points) {
    const timestamp = Date.parse(point.timestamp);
    if (Number.isNaN(timestamp) || !Number.isFinite(point.amount)) continue;

    const bucket = spendTrendBucketStart(timestamp, interval);
    totals.set(bucket, (totals.get(bucket) ?? 0) + point.amount);
  }

  return Array.from(totals, ([timestamp, amount]) => ({
    timestamp: new Date(timestamp).toISOString(),
    amount: roundCurrency(amount),
  })).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function spendTrendTotal(points: SpendTrendPoint[]): number {
  return roundCurrency(
    points.reduce(
      (total, point) => (Number.isFinite(point.amount) ? total + point.amount : total),
      0,
    ),
  );
}

const weekFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Axis/tooltip label: "Mar 4" for weeks, "Mar 2026" for months. */
export function formatSpendTrendLabel(
  timestamp: string,
  interval: SpendTrendInterval,
): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return interval === 'weekly'
    ? weekFormatter.format(date)
    : monthFormatter.format(date);
}

/** Inclusive UTC day span, useful for accessible chart summaries. */
export function spendTrendDaySpan(points: SpendTrendPoint[]): number {
  const timestamps = points
    .map((point) => Date.parse(point.timestamp))
    .filter((timestamp) => !Number.isNaN(timestamp));

  if (timestamps.length < 2) return 1;

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  return Math.max(1, Math.round((max - min) / DAY_MS) + 1);
}

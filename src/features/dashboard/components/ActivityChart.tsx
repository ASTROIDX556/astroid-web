'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartTooltipShell, type TooltipPayloadItem } from '@/components/charts';
import { cn } from '@/lib/cn';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { ActivityPoint } from '@/types/domain';

// ---------------------------------------------------------------------------
// Tokens — every color below resolves to a CSS variable from tokens.css so the
// light / dark / high-contrast themes swap the palette automatically.
// ---------------------------------------------------------------------------
const AXIS = 'rgb(var(--chart-axis))';
const GRID = 'rgb(var(--chart-grid))';
const TEXT = 'rgb(var(--text-muted))';
const COUNT_COLOR = 'rgb(var(--chart-1))'; // transaction volume
const SPEND_COLOR = 'rgb(var(--gold))'; // spend — signature accent

const axisTick = {
  fill: TEXT,
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
};

// ---------------------------------------------------------------------------
// Interval configuration
// ---------------------------------------------------------------------------
export type ActivityInterval = '24h' | '7d' | '30d';

export interface ActivityIntervalMeta {
  id: ActivityInterval;
  label: string;
  windowLabel: string;
  bucketMs: number;
  bucketCount: number;
}

export const ACTIVITY_INTERVALS: ActivityIntervalMeta[] = [
  {
    id: '24h',
    label: '24h',
    windowLabel: 'last 24 hours',
    bucketMs: 3_600_000,
    bucketCount: 24,
  },
  {
    id: '7d',
    label: '7d',
    windowLabel: 'last 7 days',
    bucketMs: 86_400_000,
    bucketCount: 7,
  },
  {
    id: '30d',
    label: '30d',
    windowLabel: 'last 30 days',
    bucketMs: 86_400_000,
    bucketCount: 30,
  },
];

const hourTick = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dayTick = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function bucketLabel(timestamp: number, interval: ActivityInterval): string {
  return interval === '24h' ? hourTick.format(timestamp) : dayTick.format(timestamp);
}

// ---------------------------------------------------------------------------
// Data shaping — fixed-width buckets ending at the newest observation, plus a
// period-over-period trend (current window vs the equally sized preceding one).
// ---------------------------------------------------------------------------
interface ActivityBucket {
  timestamp: number;
  label: string;
  count: number;
  spend: number;
}

function intervalMeta(interval: ActivityInterval): ActivityIntervalMeta {
  return ACTIVITY_INTERVALS.find((i) => i.id === interval)!;
}

function buildBuckets(
  data: ActivityPoint[],
  interval: ActivityInterval,
): ActivityBucket[] {
  const meta = intervalMeta(interval);
  const end = data.reduce(
    (max, p) => Math.max(max, new Date(p.timestamp).getTime()),
    0,
  );
  const endFloor = end - (end % meta.bucketMs);
  const start = endFloor - (meta.bucketCount - 1) * meta.bucketMs;

  const buckets: ActivityBucket[] = Array.from({ length: meta.bucketCount }, (_, i) => {
    const timestamp = start + i * meta.bucketMs;
    return { timestamp, label: bucketLabel(timestamp, interval), count: 0, spend: 0 };
  });

  for (const point of data) {
    const t = new Date(point.timestamp).getTime();
    if (t < start || t > endFloor) continue;
    const bucket = buckets[Math.floor((t - start) / meta.bucketMs)];
    if (!bucket) continue;
    bucket.count += point.count;
    bucket.spend += point.spend;
  }
  return buckets;
}

/** Percent change in transaction count: current window vs the preceding window. */
function computeTrend(
  data: ActivityPoint[],
  interval: ActivityInterval,
): number | null {
  const meta = intervalMeta(interval);
  const end = data.reduce(
    (max, p) => Math.max(max, new Date(p.timestamp).getTime()),
    0,
  );
  const endFloor = end - (end % meta.bucketMs);
  const start = endFloor - (meta.bucketCount - 1) * meta.bucketMs;
  const prevStart = start - meta.bucketCount * meta.bucketMs;

  let current = 0;
  let previous = 0;
  for (const point of data) {
    const t = new Date(point.timestamp).getTime();
    if (t >= start && t <= endFloor) current += point.count;
    else if (t >= prevStart && t < start) previous += point.count;
  }
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Highest and lowest (non-zero) buckets for the accessible chart summary. */
function extremes(
  buckets: ActivityBucket[],
): { max: ActivityBucket; min: ActivityBucket } | null {
  if (buckets.length === 0) return null;
  const first = buckets[0];
  if (!first) return null;
  let max = first;
  let min = first;
  for (const bucket of buckets) {
    if (bucket.count > max.count) max = bucket;
    if (bucket.count > 0 && (min.count === 0 || bucket.count < min.count)) min = bucket;
  }
  return { max, min };
}

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

// ---------------------------------------------------------------------------
// Trend indicator — arrow + sign + percent (never color alone).
// ---------------------------------------------------------------------------
function TrendBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Badge variant="neutral" size="sm">
        <span aria-hidden>—</span> no prior data
        <span className="sr-only">No prior period data available for comparison</span>
      </Badge>
    );
  }
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <Badge variant={up ? 'success' : 'danger'} size="sm">
      <Icon className="h-3 w-3" aria-hidden />
      <span className="tabular">
        {up ? '+' : ''}
        {value.toFixed(1)}%
      </span>
      <span className="sr-only">
        {up ? 'Up' : 'Down'} {Math.abs(value).toFixed(1)} percent versus the previous
        period
      </span>
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Interval toggle — segmented control with pressed-state semantics.
// ---------------------------------------------------------------------------
function IntervalToggle({
  value,
  onChange,
}: {
  value: ActivityInterval;
  onChange: (interval: ActivityInterval) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Chart interval"
      className="flex items-center gap-1 rounded-sm border border-border bg-surface-secondary p-1"
    >
      {ACTIVITY_INTERVALS.map((interval) => (
        <button
          key={interval.id}
          type="button"
          aria-pressed={value === interval.id}
          onClick={() => onChange(interval.id)}
          className={cn(
            'rounded-xs px-2 py-1 text-2xs font-medium transition-colors duration-base ease-astroid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === interval.id
              ? 'bg-surface text-foreground shadow-soft-1'
              : 'text-foreground-secondary hover:bg-surface-secondary hover:text-foreground',
          )}
        >
          {interval.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityChart — self-contained card: interval toggles, trend badge, and a
// responsive dual-axis area chart of transaction volume + spend over time.
// ---------------------------------------------------------------------------
export function ActivityChart({
  data,
  height = 300,
  className,
}: {
  data?: ActivityPoint[];
  height?: number;
  className?: string;
}) {
  const mounted = useMounted();
  const [interval, setInterval] = useState<ActivityInterval>('24h');
  const meta = intervalMeta(interval);

  const { buckets, trend } = useMemo(() => {
    if (!data || data.length === 0) {
      return { buckets: [] as ActivityBucket[], trend: null as number | null };
    }
    return {
      buckets: buildBuckets(data, interval),
      trend: computeTrend(data, interval),
    };
  }, [data, interval]);

  if (!mounted || !data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="skeleton w-full rounded-card" style={{ height: height + 72 }} />
    );
  }

  const ext = extremes(buckets);
  const summary = ext
    ? `Transaction activity for ${meta.windowLabel}: peak ${ext.max.count} transactions at ${ext.max.label}, lowest ${ext.min.count} at ${ext.min.label}.`
    : `Transaction activity for ${meta.windowLabel}.`;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-4">
        <div className="gap-1.5 flex flex-col">
          <CardTitle>Transaction activity</CardTitle>
          <CardDescription>Volume and spend over {meta.windowLabel}</CardDescription>
        </div>
        <div className="flex items-center gap-3" aria-live="polite">
          <TrendBadge value={trend} />
          <IntervalToggle value={interval} onChange={setInterval} />
        </div>
      </CardHeader>
      <CardContent>
        <figure>
          <div className="mb-2 flex flex-wrap items-center justify-end gap-4 text-2xs text-foreground-secondary">
            <span className="gap-1.5 inline-flex items-center">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: COUNT_COLOR }}
                aria-hidden
              />
              Transactions
            </span>
            <span className="gap-1.5 inline-flex items-center">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: SPEND_COLOR }}
                aria-hidden
              />
              Spend
            </span>
          </div>
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient
                  id={`activity-count-${interval}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={COUNT_COLOR} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={COUNT_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient
                  id={`activity-spend-${interval}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={SPEND_COLOR} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SPEND_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={axisTick}
                axisLine={{ stroke: AXIS }}
                tickLine={false}
                minTickGap={24}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="count"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <YAxis
                yAxisId="spend"
                orientation="right"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={(v: number) =>
                  formatCurrency(v, 'USDC', { compact: true })
                }
              />
              <RechartsTooltip
                cursor={{ stroke: GRID, strokeWidth: 1 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const items = payload as TooltipPayloadItem[];
                  return (
                    <ChartTooltipShell label={String(label)}>
                      {items.map((item) => (
                        <div
                          key={String(item.dataKey)}
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="gap-1.5 flex items-center capitalize text-foreground-secondary">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: item.color }}
                              aria-hidden
                            />
                            {item.name}
                          </span>
                          <span className="tabular font-medium text-foreground">
                            {item.dataKey === 'spend'
                              ? formatCurrency(Number(item.value), 'USDC', {
                                  compact: true,
                                })
                              : formatNumber(Number(item.value))}
                          </span>
                        </div>
                      ))}
                    </ChartTooltipShell>
                  );
                }}
              />
              <Area
                yAxisId="count"
                type="monotone"
                dataKey="count"
                name="Transactions"
                stroke={COUNT_COLOR}
                strokeWidth={2}
                fill={`url(#activity-count-${interval})`}
              />
              <Area
                yAxisId="spend"
                type="monotone"
                dataKey="spend"
                name="Spend"
                stroke={SPEND_COLOR}
                strokeWidth={2}
                fill={`url(#activity-spend-${interval})`}
              />
            </AreaChart>
          </ResponsiveContainer>
          <figcaption className="sr-only">{summary}</figcaption>
        </figure>
      </CardContent>
    </Card>
  );
}

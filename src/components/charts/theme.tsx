'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to ensure component is mounted before rendering charts.
 * Prevents hydration mismatches with SSR when using Recharts.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/**
 * Chart color tokens mapped from CSS custom properties.
 * These match the tokens defined in src/styles/tokens.css
 */
export const CHART_TOKENS = {
  // Axis and grid
  axis: 'rgb(var(--chart-axis))',
  grid: 'rgb(var(--chart-grid))',
  text: 'rgb(var(--text-muted))',
  surface: 'rgb(var(--chart-surface))',

  // Semantic colors
  gold: 'rgb(var(--gold))',
  success: 'rgb(var(--success))',
  warning: 'rgb(var(--warning))',
  danger: 'rgb(var(--danger))',
  info: 'rgb(var(--info))',

  // Categorical palette for multi-series charts
  categorical: [
    'rgb(var(--chart-1))', // blue
    'rgb(var(--chart-2))', // orange
    'rgb(var(--chart-3))', // aqua
    'rgb(var(--chart-4))', // yellow
    'rgb(var(--chart-5))', // magenta
    'rgb(var(--chart-6))', // green
    'rgb(var(--chart-7))', // violet
    'rgb(var(--chart-8))', // red
  ],

  // Asset-specific colors (using categorical palette indices)
  assets: {
    USDC: 'rgb(var(--chart-1))', // blue
    XLM: 'rgb(var(--chart-4))',  // yellow/gold
    ASTRO: 'rgb(var(--chart-7))', // violet
    EURC: 'rgb(var(--chart-6))', // green
  },
} as const;

/**
 * Standard axis tick configuration for consistent styling across charts.
 */
export const axisTick = {
  fill: CHART_TOKENS.text,
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
};

/**
 * Creates a linear gradient definition for area charts.
 */
export function createGradientId(prefix: string, color: string): string {
  return `${prefix}-${color.replace('rgb(', '').replace(')', '').replace(/\s+/g, '')}`;
}

/**
 * Default chart margins for consistent spacing.
 */
export const CHART_MARGINS = {
  standard: { top: 8, right: 8, left: 0, bottom: 0 },
  withYAxis: { top: 8, right: 8, left: 52, bottom: 0 },
  verticalBar: { top: 4, right: 16, left: 8, bottom: 4 },
} as const;

/**
 * Formats currency values for chart tooltips and axes.
 */
import { formatCurrency } from '@/lib/format';

export function formatChartCurrency(value: number, currency = 'USDC', compact = true): string {
  return formatCurrency(value, currency, { compact });
}

/**
 * Standard tooltip content wrapper using the glass design token.
 */
export function ChartTooltipShell({
  label,
  children,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass min-w-[160px] rounded-md px-3 py-2 text-xs shadow-soft-2">
      {label != null && (
        <p className="mb-1.5 font-medium text-foreground">{label}</p>
      )}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

/**
 * Short date formatter for time-series X-axis labels.
 */
export function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

/**
 * Skeleton placeholder for chart loading states.
 */
export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <div className="skeleton w-full rounded-md" style={{ height }} />;
}

/**
 * Empty state placeholder for charts with no data.
 */
export function ChartEmptyState({
  height = 260,
  title = 'No data available',
  description = 'Data will appear here once available.',
}: {
  height?: number;
  title?: string;
  description?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-md border border-border/50 bg-surface-secondary/30 text-center"
      style={{ height }}
      role="status"
      aria-label={title}
    >
      <div className="text-foreground-muted">{title}</div>
      <p className="text-2xs text-foreground-secondary max-w-xs">{description}</p>
    </div>
  );
}
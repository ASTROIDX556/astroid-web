import { createElement, useEffect, useState, type ReactNode } from 'react';
import { formatCurrency } from '@/lib/format';

/**
 * Chart colors, all resolved from the design tokens in `styles/tokens.css`.
 *
 * Those tokens hold space-separated RGB channels (`216 204 188`) so Tailwind can
 * apply opacity, which means a color has to be written `rgb(var(--border))`:
 * a bare `var(--border)` is not a valid color and an SVG `stroke`/`fill` set to
 * it falls back to the browser default. Build every chart color through
 * {@link chartToken} (or the constants below) rather than writing `var()` or a
 * hex value, and the light, dark and high-contrast themes swap them for free.
 */

/** `rgb(var(--name))`, optionally with an alpha between 0 and 1. */
export function chartToken(name: string, alpha?: number): string {
  return alpha === undefined ? `rgb(var(--${name}))` : `rgb(var(--${name}) / ${alpha})`;
}

export const CHART_COLORS = {
  axis: chartToken('chart-axis'),
  grid: chartToken('chart-grid'),
  /** Tick labels. */
  text: chartToken('text-muted'),
  textSecondary: chartToken('text-secondary'),
  border: chartToken('border'),
  /** Neutral fill, e.g. the "allocated" track behind a consumption bar. */
  track: chartToken('surface-secondary'),
  /** Gap between slices and tiles. */
  surface: chartToken('chart-surface'),
  /** Text drawn on a colored fill (treemap labels). */
  onFill: chartToken('chart-on-fill'),
  accent: chartToken('gold'),
  success: chartToken('success'),
  warning: chartToken('warning'),
  danger: chartToken('danger'),
} as const;

/** Categorical palette, in the order series are assigned. */
export const CHART_SERIES: readonly string[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
  chartToken(`chart-${n}`),
);

/** Tick style shared by every axis. */
export const AXIS_TICK = {
  fill: CHART_COLORS.text,
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
} as const;

// ---------------------------------------------------------------------------
// Budget consumption
// ---------------------------------------------------------------------------

export type BudgetStatus = 'normal' | 'warning' | 'danger';

export const BUDGET_STATUS_COLOR: Record<BudgetStatus, string> = {
  normal: chartToken('chart-1'),
  warning: CHART_COLORS.warning,
  danger: CHART_COLORS.danger,
};

/** Share of `allocated` that is `consumed`, as a percentage. Zero when nothing is allocated. */
export function utilizationPercent(consumed: number, allocated: number): number {
  if (!Number.isFinite(consumed) || !Number.isFinite(allocated) || allocated <= 0) return 0;
  return (consumed / allocated) * 100;
}

/** Warning from 80% of the allocation, danger once it is used up. */
export function budgetStatus(utilization: number): BudgetStatus {
  if (utilization >= 100) return 'danger';
  if (utilization >= 80) return 'warning';
  return 'normal';
}

export const CHART_TOKENS = {
  axis: CHART_COLORS.axis,
  grid: CHART_COLORS.grid,
  text: CHART_COLORS.text,
  surface: CHART_COLORS.surface,
  gold: CHART_COLORS.accent,
  success: CHART_COLORS.success,
  warning: CHART_COLORS.warning,
  danger: CHART_COLORS.danger,
  info: chartToken('info'),
  categorical: CHART_SERIES,
  assets: {
    USDC: chartToken('chart-1'),
    XLM: chartToken('chart-4'),
    ASTRO: chartToken('chart-7'),
    EURC: chartToken('chart-6'),
  },
} as const;

export const axisTick = AXIS_TICK;
export const CHART_MARGINS = {
  standard: { top: 8, right: 8, left: 0, bottom: 0 },
  withYAxis: { top: 8, right: 8, left: 52, bottom: 0 },
  verticalBar: { top: 4, right: 16, left: 8, bottom: 4 },
} as const;

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function ChartTooltipShell({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return createElement(
    'div',
    { className: 'glass min-w-[160px] rounded-md px-3 py-2 text-xs shadow-soft-2' },
    label == null ? null : createElement('p', { className: 'mb-1.5 font-medium text-foreground' }, label),
    createElement('div', { className: 'flex flex-col gap-1' }, children),
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return createElement('div', { className: 'skeleton w-full rounded-md', style: { height } });
}

export function ChartEmptyState({
  height = 260,
  title = 'No data available',
  description = 'Data will appear here once available.',
}: { height?: number; title?: string; description?: string }) {
  return createElement(
    'div',
    {
      className: 'flex flex-col items-center justify-center gap-2 rounded-md border border-border/50 bg-surface-secondary/30 text-center',
      style: { height },
      role: 'status',
      'aria-label': title,
    },
    createElement('div', { className: 'text-foreground-muted' }, title),
    createElement('p', { className: 'max-w-xs text-2xs text-foreground-secondary' }, description),
  );
}

export function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function formatChartCurrency(value: number, currency = 'USDC', compact = true): string {
  return formatCurrency(value, currency, { compact });
}

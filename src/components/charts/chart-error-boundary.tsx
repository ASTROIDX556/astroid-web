'use client';

import type { ReactNode } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export interface ChartErrorBoundaryProps {
  /** Chart or widget name used in logs and the fallback copy. */
  label: string;
  /**
   * Fixed fallback height so a crashed chart cannot collapse the surrounding
   * layout. Accepts any CSS length; defaults to the standard chart height.
   */
  height?: number | string;
  /** Remounts the subtree when this value changes while in the error state. */
  resetKey?: string | number;
  /** Optional recovery hook (e.g. refetch the failed query) before retry. */
  onReset?: () => void;
  className?: string;
  children: ReactNode;
}

const cssHeight = (height: number | string) =>
  typeof height === 'number' ? `${height}px` : height;

/**
 * Error boundary for Recharts/data-visualization widgets (#480). Malformed
 * time-series data must degrade to an informative, retryable fallback — never
 * take the whole dashboard view down with it. Built on the shared
 * {@link ErrorBoundary}; the fallback keeps the chart's footprint and names
 * the failing widget for operators.
 */
export function ChartErrorBoundary({
  label,
  height = 260,
  resetKey,
  onReset,
  className,
  children,
}: ChartErrorBoundaryProps) {
  return (
    <ErrorBoundary
      section={label}
      resetKey={resetKey}
      onReset={onReset}
      fallback={(_error, retry) => (
        <div
          role="alert"
          aria-live="polite"
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-danger/40 bg-danger-soft/30 p-6 text-center',
            className,
          )}
          style={{ minHeight: cssHeight(height) }}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-danger-soft text-danger">
            <BarChart3 className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
              {label} could not be rendered
            </h3>
            <p className="max-w-sm text-xs text-foreground-secondary">
              The chart data may be malformed. The rest of the dashboard is
              unaffected — try again to reload it.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={retry}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          >
            Try again
          </Button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ChartErrorBoundary;

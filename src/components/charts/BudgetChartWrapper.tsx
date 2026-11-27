'use client';

import type { ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

import { ChartErrorBoundary } from '@/components/ui/chart-error-boundary';
import { cn } from '@/lib/cn';

interface BudgetChartWrapperProps {
  children: ReactElement;
  className?: string;
  height?: number | string;
  aspectRatio?: number;
  minHeight?: number;
}

/** Constrains chart sizing and lets Recharts observe responsive parent changes. */
export function BudgetChartWrapper({
  children,
  className,
  height,
  aspectRatio = 1.6,
  minHeight = 160,
}: BudgetChartWrapperProps) {
  return (
    <div
      className={cn('w-full min-w-0', className)}
      style={
        height !== undefined
          ? { height }
          : { aspectRatio, minHeight }
      }
    >
      <ChartErrorBoundary
        compact
        title="Chart unavailable"
        description="This budget chart hit a rendering error. Retry to remount it without reloading the dashboard."
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          minHeight={minHeight}
          debounce={80}
        >
          {children}
        </ResponsiveContainer>
      </ChartErrorBoundary>
    </div>
  );
}
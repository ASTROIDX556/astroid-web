'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { redactSensitive } from '@/components/common/ErrorBoundary';
import { cn } from '@/lib/cn';

const isProduction = process.env.NODE_ENV === 'production';

export interface ChartErrorBoundaryProps {
  children: ReactNode;
  /** Headline shown in the fallback. Defaults to "Chart unavailable". */
  title?: string;
  /** Supporting copy shown under the headline. */
  description?: string;
  /** Called before the subtree is remounted (e.g. refetch the chart query). */
  onRetry?: () => void;
  /** Telemetry/diagnostics hook invoked with the caught error. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Changing this value while in the error state retries automatically. */
  resetKey?: string | number;
  /** Tighter padding for chart-sized dashboard widgets. */
  compact?: boolean;
  className?: string;
}

export interface ChartErrorState {
  error: Error | null;
  /** Bumped on retry so the chart subtree remounts with fresh state. */
  retryToken: number;
}

/** Pure recovery transition used by both retry paths in the boundary. */
export function chartErrorRetryState(state: ChartErrorState): ChartErrorState {
  return { error: null, retryToken: state.retryToken + 1 };
}

/**
 * Error boundary specialized for Recharts/metric widgets.
 *
 * A malformed data point or a chart rendering failure should never take down
 * the surrounding dashboard. This boundary catches render/lifecycle errors,
 * logs a redacted diagnostic, and replaces only the chart with a
 * design-token-styled fallback offering a safe retry: the retry clears the
 * error and bumps a key so the chart remounts instead of replaying the same
 * broken internal state.
 *
 * Usage:
 *   <ChartErrorBoundary title="Cashflow chart unavailable" onRetry={refetch}>
 *     <ChartFrame label="Cashflow">{chart}</ChartFrame>
 *   </ChartErrorBoundary>
 */
export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorState
> {
  override state: ChartErrorState = { error: null, retryToken: 0 };

  static getDerivedStateFromError(error: Error): Pick<ChartErrorState, 'error'> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[ChartErrorBoundary] chart failed to render: ${redactSensitive(error.message)}`,
    );
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(prevProps: ChartErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.retry();
    }
  }

  private retry = (): void => {
    this.props.onRetry?.();
    this.setState((state) => chartErrorRetryState(state));
  };

  override render(): ReactNode {
    const { error, retryToken } = this.state;

    if (error === null) {
      // Keying the fragment remounts the chart on retry, so a failed chart
      // never stays stuck on its own broken state.
      return <React.Fragment key={retryToken}>{this.props.children}</React.Fragment>;
    }

    const {
      title = 'Chart unavailable',
      description = 'The chart data or configuration could not be rendered. The rest of the dashboard is unaffected.',
      compact = false,
      className,
    } = this.props;

    return (
      <div
        role="alert"
        aria-live="assertive"
        data-chart-error-boundary="true"
        className={cn(
          'flex flex-col items-center justify-center rounded-card border border-dashed border-danger/40 bg-danger-soft/30 text-center',
          compact ? 'gap-3 p-5' : 'gap-4 p-8',
          className,
        )}
      >
        <span
          className={cn(
            'grid place-items-center rounded-full bg-danger-soft text-danger',
            compact ? 'h-10 w-10' : 'h-12 w-12',
          )}
          aria-hidden
        >
          <AlertTriangle className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        </span>

        <div className="flex max-w-sm flex-col gap-1">
          <h3
            className={cn(
              'font-display font-semibold tracking-tight text-foreground',
              compact ? 'text-sm' : 'text-base',
            )}
          >
            {title}
          </h3>
          <p className="text-xs leading-relaxed text-foreground-secondary">{description}</p>
          <code className="mt-1 block max-w-full break-words rounded-xs bg-surface-secondary px-2 py-1 text-2xs text-foreground-muted">
            {isProduction
              ? 'Diagnostic details are hidden in production.'
              : redactSensitive(error.message)}
          </code>
        </div>

        <button
          type="button"
          onClick={this.retry}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-button border border-border bg-surface px-3 text-xs font-medium text-foreground shadow-soft-1 transition-all duration-base ease-astroid hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry chart
        </button>
      </div>
    );
  }
}

export default ChartErrorBoundary;

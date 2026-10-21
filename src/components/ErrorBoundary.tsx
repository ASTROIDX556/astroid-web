export {
  ErrorBoundary,
  ErrorBoundary as default,
  redactSensitive,
} from '@/components/common/ErrorBoundary';
export type { ErrorBoundaryProps } from '@/components/common/ErrorBoundary';
'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Human-readable name for the wrapped section; adds context to logs. */
  section?: string;
  /** When this value changes while the boundary is in its error state, the boundary resets and retries rendering. */
  resetKey?: string | number;
  /** Optional custom fallback renderer. Receives the caught error and a retry callback. */
  fallback?: (error: Error, retry: () => void) => ReactNode;
  /** Optional telemetry/observability hook invoked with the caught error. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Tighter padding + copy for card/grid-sized dashboard widgets. */
  compact?: boolean;
  /** Extra classes for the default fallback card (e.g. `h-full` in a grid cell). */
  className?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Reusable class-based error boundary. Catches render/lifecycle errors thrown
 * anywhere in its subtree, logs them gracefully (message-only in production,
 * full stack in development), and replaces the broken section with a
 * design-token fallback card offering a "Try again" retry — so one failing
 * widget can no longer crash the whole application tree.
 *
 * Usage:
 *   <ErrorBoundary section="Agent timeline">
 *     <AgentTimeline />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const prefix = this.props.section
      ? `[ErrorBoundary: ${this.props.section}]`
      : '[ErrorBoundary]';
    if (isProduction) {
      // Avoid leaking stack traces / internal paths to the browser console in prod.
      console.error(`${prefix} ${error.message}`);
    } else {
      console.error(`${prefix} caught a component error:`, error, info.componentStack);
    }
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.retry();
    }
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.retry);

    const { compact, className } = this.props;

    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center rounded-card border border-dashed border-danger/40 bg-danger-soft/30 text-center',
          compact ? 'gap-3 p-5' : 'gap-4 p-10',
          className,
        )}
      >
        <span
          className={cn(
            'grid place-items-center rounded-full bg-danger-soft text-danger',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          <AlertTriangle className={compact ? 'h-5 w-5' : 'h-7 w-7'} aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h3
            className={cn(
              'font-display font-semibold tracking-tight text-foreground',
              compact ? 'text-sm' : 'text-lg',
            )}
          >
            This section failed to render
          </h3>
          <p className="max-w-sm text-xs text-foreground-secondary">
            {isProduction
              ? `Something went wrong${this.props.section ? ` while loading ${this.props.section.toLowerCase()}` : ''}. The rest of the page is unaffected.`
              : error.message}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={this.retry}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
        >
          Try again
        </Button>
      </div>
    );
  }
}

export default ErrorBoundary;

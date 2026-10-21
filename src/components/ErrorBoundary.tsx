'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  /** Invoked after the error state has been cleared and the children retry. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const isProduction = process.env.NODE_ENV === 'production';

/** React can technically throw any value; normalize it so the fallback is safe. */
function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string' && value.trim().length > 0) return new Error(value);
  return new Error('An unexpected error occurred.');
}

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

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const normalized = toError(error);
    const prefix = this.props.section ? `[ErrorBoundary: ${this.props.section}]` : '[ErrorBoundary]';
    if (isProduction) {
      // Avoid leaking stack traces / internal paths to the browser console in prod.
      console.error(`${prefix} ${normalized.message}`);
    } else {
      console.error(`${prefix} caught a component error:`, normalized, info.componentStack);
    }
    this.props.onError?.(normalized, info);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.retry();
    }
  }

  private retry = (): void => {
    this.setState({ error: null }, () => {
      this.props.onReset?.();
    });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.retry);

    return (
      <motion.div
        role="alert"
        data-testid="error-boundary-fallback"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-4 rounded-card border border-dashed border-danger/40 bg-danger-soft/30 p-10 text-center"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
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
      </motion.div>
    );
  }
}

export default ErrorBoundary;

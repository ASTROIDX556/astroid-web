'use client';

import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
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
  /** Optional recovery hook (e.g. refetch the failed query) invoked before the subtree remounts. */
  onReset?: () => void;
  /** Tighter padding for card-sized dashboard widgets. */
  compact?: boolean;
  /** Extra classes for the fallback card. */
  className?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Bumped on retry so the subtree remounts and its internal state is reset. */
  retryToken: number;
}

const isProduction = process.env.NODE_ENV === 'production';

const REDACTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Stellar secret keys (S followed by 55 base-32 characters).
  [/\bS[A-Z2-7]{55}\b/g, '[redacted stellar secret]'],
  // Provider API keys and bearer tokens.
  [/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{8,}\b/gi, '[redacted api key]'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]'],
  // `apiKey=...`, `secret: ...`, `password="..."` style payloads.
  [
    /(\b(?:api[_-]?key|secret|token|password|private[_-]?key)\b\s*[:=]\s*)(["']?)[^\s"',}&]+\2/gi,
    '$1$2[redacted]$2',
  ],
  // Sensitive query-string parameters.
  [/([?&](?:api[_-]?key|key|token|secret)=)[^&\s]+/gi, '$1[redacted]'],
  // Long hex blobs (private keys / seed material).
  [/\b[0-9a-f]{64,}\b/gi, '[redacted hex secret]'],
];

/** Removes credential-shaped values before errors reach console or telemetry. */
export function redactSensitive(value: string): string {
  return REDACTION_PATTERNS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value,
  );
}

/**
 * Reusable class-based error boundary. Catches render/lifecycle errors thrown
 * anywhere in its subtree, logs a redacted message (never wallet secrets or
 * provider keys), and replaces the broken section with a design-token fallback
 * card offering a "Try again" retry. Retrying remounts the subtree (and bumps
 * `resetKey` consumers can use to refetch) so one failing widget cannot crash
 * the whole page — or get stuck in a stale error state.
 *
 * Usage:
 *   <ErrorBoundary section="Agent timeline">
 *     <AgentTimeline />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, retryToken: 0 };

  static getDerivedStateFromError(error: Error): Pick<ErrorBoundaryState, 'error'> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const prefix = this.props.section
      ? `[ErrorBoundary: ${this.props.section}]`
      : '[ErrorBoundary]';
    const message = redactSensitive(error.message);

    if (isProduction) {
      // Avoid leaking stacks, internal paths, request headers, or credentials.
      console.error(`${prefix} ${message}`);
    } else {
      console.error(
        `${prefix} caught a component error: ${message}\n${redactSensitive(
          error.stack ?? info.componentStack ?? '',
        )}`,
      );
    }

    this.props.onError?.(error, info);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.retry();
    }
  }

  private retry = (): void => {
    this.props.onReset?.();
    this.setState((prev) => ({ error: null, retryToken: prev.retryToken + 1 }));
  };

  override render(): ReactNode {
    const { error, retryToken } = this.state;
    if (error === null) {
      // Keying the fragment remounts the entire subtree on retry, resetting
      // component/query state rather than replaying it against the same error.
      return <Fragment key={retryToken}>{this.props.children}</Fragment>;
    }

    if (this.props.fallback) return this.props.fallback(error, this.retry);

    const { compact, className } = this.props;

    return (
      <div
        role="alert"
        aria-live="polite"
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
              ? `Something went wrong${
                  this.props.section
                    ? ` while loading ${this.props.section.toLowerCase()}`
                    : ''
                }. The rest of the page is unaffected.`
              : redactSensitive(error.message)}
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

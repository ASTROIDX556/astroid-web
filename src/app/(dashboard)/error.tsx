'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Next.js route-level error boundary for the dashboard segment.
 * Catches any unhandled render or async error inside (dashboard)/** and replaces
 * the broken page with a recoverable, design-token styled error card — no more
 * "Application error: a client-side exception has occurred."
 *
 * Data-fetch failures never reach this boundary: queries own their fallback via
 * QueryBoundary so a single degraded widget cannot take the whole dashboard
 * down. This only handles unexpected render faults.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Astroid Dashboard Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-8">
      <div
        role="alert"
        aria-live="polite"
        className="flex w-full max-w-md flex-col items-center gap-5 rounded-card border border-dashed border-danger/40 bg-danger-soft/20 p-10 text-center"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </span>
        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm leading-relaxed text-foreground-secondary">
            {error?.message || 'An unexpected error occurred while loading this page.'}
          </p>
          {error?.digest && (
            <p className="text-2xs text-foreground-muted">
              Reference: <code className="font-mono">{error.digest}</code>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={reset}
            leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
          >
            Try again
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}

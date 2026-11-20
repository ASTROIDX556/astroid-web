'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Next.js route-level error boundary for the dashboard segment.
 * Catches any unhandled render or async error inside (dashboard)/**
 * and replaces the broken page with a recoverable inline error card —
 * no more "Application error: a client-side exception has occurred."
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
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-dashed border-danger/40 bg-danger-soft/20 p-10 text-center">
        <span className="h-14 w-14 grid place-items-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </span>
        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="text-sm text-foreground-secondary">
            {error?.message ?? 'An unexpected error occurred while loading this page.'}
          </p>
        </div>
        <button
          onClick={reset}
          className="py-2.5 inline-flex items-center gap-2 rounded-md bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      </div>
    </div>
  );
}

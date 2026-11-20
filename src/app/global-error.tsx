'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Global error boundary — catches crashes that happen outside the dashboard
 * route segment (e.g. in the root layout, providers, or auth pages).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Astroid Global Error]', error);
  }, [error]);

  return (
    <html lang="en" data-theme="light">
      <body className="flex min-h-screen items-center justify-center bg-[#F6F2EA] p-8 font-sans text-[#171412]">
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-dashed border-red-500/40 bg-red-50 p-10 text-center">
          <span className="h-14 w-14 grid place-items-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-7 w-7" aria-hidden />
          </span>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Something went wrong
            </h2>
            <p className="text-sm text-[#5A544F]">
              {error?.message ?? 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={reset}
            className="py-2.5 inline-flex items-center gap-2 rounded-md bg-[#171412] px-5 text-sm font-medium text-[#F6F2EA] transition-opacity hover:opacity-80"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

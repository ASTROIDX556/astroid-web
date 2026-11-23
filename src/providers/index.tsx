'use client';

import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

/** Root client provider stack: theme tokens and data layer. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        {children}
      </QueryProvider>
    </ThemeProvider>
  );
}

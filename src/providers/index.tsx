'use client';

import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';
import { WalletStoreBridge } from './wallet-store-bridge';

/** Root client provider stack: theme tokens and data layer. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <WalletStoreBridge />
        {children}
      </QueryProvider>
    </ThemeProvider>
  );
}

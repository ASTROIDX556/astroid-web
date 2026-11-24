'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { QUERY_CLIENT_QUERY_DEFAULTS } from '@/lib/query-config';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: QUERY_CLIENT_QUERY_DEFAULTS,
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

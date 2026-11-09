'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true once the component has mounted on the client. Persisted
 * zustand stores rehydrate from localStorage *after* the first render, so any
 * UI that reads persisted values must gate on this flag to avoid
 * server/client hydration mismatches in Next.js SSR.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

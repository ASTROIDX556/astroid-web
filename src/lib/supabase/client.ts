'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env, isSupabaseConfigured } from '@/lib/env';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Lazily-created Supabase browser client singleton, or `null` when no project
 * URL/anon key is configured. Callers must fall back to mock/polling behavior on `null`.
 *
 * This client handles token storage in cookies and automatic session refresh
 * via the `@supabase/ssr` package.
 */
export function getSupabaseBrowserClient(): ReturnType<typeof createBrowserClient> | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  }

  return browserClient;
}

/**
 * React hook to access the Supabase browser client with proper typing.
 * Returns `null` in mock mode so components can conditionally render.
 */
export function useSupabaseClient() {
  // This is a simple wrapper for type safety and semantic clarity
  return getSupabaseBrowserClient();
}

/**
 * Checks if Supabase is configured on the client side.
 * Useful for conditional rendering of auth-dependent features.
 */
export function isSupabaseClientConfigured(): boolean {
  return isSupabaseConfigured;
}
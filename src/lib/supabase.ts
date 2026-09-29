import { createBrowserClient } from '@supabase/ssr';
import { env, isSupabaseConfigured } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Lazily-created Supabase browser client, or `null` when no project URL/anon
 * key is configured. Callers must fall back to mock/polling behavior on `null`.
 */
export function getSupabaseClient(): ReturnType<typeof createBrowserClient> | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  return client;
}

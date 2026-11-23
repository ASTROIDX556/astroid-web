import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env, isSupabaseConfigured } from '@/lib/env';

/**
 * Creates a Supabase server client for use in Server Components, Server Actions,
 * and Route Handlers. Returns `null` when Supabase is not configured (mock mode),
 * allowing callers to fall back to mock data.
 *
 * This client reads/writes auth cookies via Next.js `cookies()` and automatically
 * refreshes expired sessions on each request.
 */
export function createSupabaseServerClient() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const cookieStore = cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

/**
 * Convenience helper to get the current user session in server components.
 * Returns `{ user, session }` or `{ user: null, session: null }` when not configured
 * or no active session exists.
 */
export async function getSupabaseSession() {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { user: null, session: null };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    user: session?.user ?? null,
    session,
  };
}

/**
 * Requires an authenticated user — throws/redirects if no session.
 * Use in protected Server Components or Server Actions.
 */
export async function requireSupabaseSession() {
  const { user, session } = await getSupabaseSession();

  if (!user || !session) {
    return { user: null, session: null };
  }

  return { user, session };
}
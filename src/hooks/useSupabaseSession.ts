'use client';

import { useEffect, useState } from 'react';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';

export interface UseSupabaseSessionResult {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isLive: boolean;
  error: Error | null;
}

/**
 * Custom React hook to synchronize Supabase user authentication sessions
 * with application state across dashboard pages.
 * 
 * Handles auth state change events (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`)
 * securely, and gracefully falls back to mock user data when Supabase
 * environment variables are unset.
 */
export function useSupabaseSession(): UseSupabaseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const isLive = isSupabaseConfigured;

  useEffect(() => {
    const client = getSupabaseClient();

    if (!client) {
      setIsLoading(false);
      // Fallback mock session state when environment variables are unset
      setSession({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'mock-user-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'admin@astroid.local',
          app_metadata: { provider: 'email', roles: ['admin'] },
          user_metadata: { full_name: 'Alex Rivera', org: 'Astroid Engineering' },
          created_at: new Date().toISOString(),
        },
      } as unknown as Session);
      setUser({
        id: 'mock-user-id',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'admin@astroid.local',
        app_metadata: { provider: 'email', roles: ['admin'] },
        user_metadata: { full_name: 'Alex Rivera', org: 'Astroid Engineering' },
        created_at: new Date().toISOString(),
      } as unknown as User);
      return;
    }

    let isMounted = true;

    async function fetchInitialSession() {
      try {
        setIsLoading(true);
        const {
          data: { session: currentSession },
          error: sessionError,
        } = await client.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (isMounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to retrieve Supabase session'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchInitialSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event: AuthChangeEvent, updatedSession: Session | null) => {
      if (!isMounted) return;

      // Handles SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED and other auth state changes
      setSession(updatedSession);
      setUser(updatedSession?.user ?? null);
      setIsLoading(false);

      if (event === 'TOKEN_REFRESHED') {
        // Session token successfully refreshed securely
        setError(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user,
    isLoading,
    isLive,
    error,
  };
}

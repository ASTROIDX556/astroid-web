// Server-side Supabase client (Server Components, Server Actions, Route Handlers)
export { createSupabaseServerClient, getSupabaseSession, requireSupabaseSession } from './server';

// Client-side Supabase client (Client Components, browser)
export { getSupabaseBrowserClient, useSupabaseClient, isSupabaseClientConfigured } from './client';
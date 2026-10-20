import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env, isSupabaseConfigured } from '@/lib/env';

/**
 * Next.js middleware for Supabase SSR session synchronization.
 *
 * This middleware:
 * 1. Creates a Supabase server client with access to request/response cookies
 * 2. Refreshes expired auth sessions automatically on each request
 * 3. Protects dashboard routes when Supabase is configured
 * 4. Falls back gracefully to mock mode when Supabase is not configured
 *
 * The middleware runs on all routes except static assets and API routes
 * that don't need auth context.
 */
export async function middleware(request: NextRequest) {
  // Skip middleware entirely in mock mode — no Supabase, no session management
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session if expired — this is the core SSR session sync
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Define protected route prefixes
  const protectedPrefixes = [
    '/overview',
    '/wallets',
    '/transactions',
    '/analytics',
    '/settings',
    '/approvals',
    '/budgets',
    '/policies',
    '/memory',
    '/audit',
    '/multisig',
    '/agents',
    '/developers',
  ];

  const isProtectedRoute = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  // If accessing a protected route without a valid session, redirect to auth
  if (isProtectedRoute && !session) {
    const authUrl = new URL('/auth', request.url);
    authUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(authUrl);
  }

  // If user has a session and tries to access /auth, redirect to overview
  if (session && request.nextUrl.pathname === '/auth') {
    return NextResponse.redirect(new URL('/overview', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt (static assets)
     * - api/webhooks (webhook endpoints that don't need auth)
     * - public files (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};
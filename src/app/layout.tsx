import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { fontVariables } from '@/lib/fonts';
import { AppProviders } from '@/providers';
import { CursorProvider } from '@/components/effects/user-cursor';
import { THEME_COOKIE, readThemeCookie, resolveThemeValue } from '@/lib/theme-cookie';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Astroid — Financial Operating System for AI Agents',
    template: '%s · Astroid',
  },
  description:
    'Astroid is the financial operating system for autonomous AI agents on Stellar — wallets, policies, budgets, approvals and a financial memory that reconstructs why every payment happened.',
  applicationName: 'Astroid',
  keywords: [
    'Astroid',
    'Stellar',
    'AI agents',
    'agentic payments',
    'treasury',
    'financial operating system',
  ],
  authors: [{ name: 'Astroid' }],
  metadataBase: new URL('https://astroid.finance'),
  openGraph: {
    title: 'Astroid — Financial Operating System for AI Agents',
    description:
      'Give autonomous agents a wallet, a budget, and a conscience. Governed spend on Stellar with a financial memory of every decision.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F2EA' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeMode = readThemeCookie(cookies().get(THEME_COOKIE)?.value ?? null);
  const resolvedTheme = resolveThemeValue(themeMode);

  return (
    <html lang="en" className={fontVariables} data-theme={resolvedTheme} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var match = document.cookie.match(/(?:^|; )${encodeURIComponent(THEME_COOKIE)}=([^;]*)/);
                  var mode = match ? decodeURIComponent(match[1]) : 'light';
                  if (mode === 'system') {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    mode = prefersDark ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', mode);
                } catch (e) {}
              })()
            `.replace(/\$\{encodeURIComponent\(THEME_COOKIE\)\}/g, encodeURIComponent(THEME_COOKIE)),
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only rounded-sm bg-foreground px-4 py-2 text-background focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200]"
        >
          Skip to content
        </a>
        <AppProviders>
          <CursorProvider>{children}</CursorProvider>
        </AppProviders>
      </body>
    </html>
  );
}

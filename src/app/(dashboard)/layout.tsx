'use client';

import { useState } from 'react';

import { Topbar } from '@/components/shell/topbar';
import { DesktopSidebar } from '@/components/shell/desktop-sidebar';
import { MobileNav } from '@/components/shell/mobile-nav';
import { CommandPalette } from '@/components/shell/command-palette';
import { AssistantDrawer } from '@/components/shell/assistant-drawer';
import { usePreferencesStore, useHydrated } from '@/stores';
import { cn } from '@/lib/cn';

/**
 * The authenticated workspace shell: a utility top bar, persistent desktop
 * navigation, and the global overlays
 * (command palette, AI assistant, mobile nav drawer). Page content renders in
 * the scrollable main column, capped to the shell max width, with bottom room
 * while keeping the navigation rail visible on desktop.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  // Density is a persisted preference; gate the read so SSR markup always
  // renders the default and upgrades after rehydration (no mismatch).
  const hydrated = useHydrated();
  const compact = usePreferencesStore((s) => s.density === 'compact');

  return (
    <div
      data-density={hydrated && compact ? 'compact' : 'comfortable'}
      className={cn(
        'flex min-h-screen flex-col bg-background',
        hydrated && compact && 'text-[13px]',
      )}
    >
      {/* Keyboard shortcut past the shell chrome — first tab stop on every page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[110] focus:rounded-button focus:border focus:border-border focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-soft-2"
      >
        Skip to main content
      </a>
      <Topbar navOpen={navOpen} onOpenNav={() => setNavOpen(true)} />

      <div className="flex flex-1">
        <DesktopSidebar />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
      <CommandPalette />
      <AssistantDrawer />
    </div>
  );
}

'use client';

import { useState } from 'react';

import { Topbar } from '@/components/shell/topbar';
import { CommandDock } from '@/components/shell/command-dock';
import { MobileNav } from '@/components/shell/mobile-nav';
import { CommandPalette } from '@/components/shell/command-palette';
import { AssistantDrawer } from '@/components/shell/assistant-drawer';

/**
 * The authenticated workspace shell: a slim utility top bar, the floating
 * command dock (primary navigation on desktop), and the global overlays
 * (command palette, AI assistant, mobile nav drawer). Page content renders in
 * the scrollable main column, capped to the shell max width, with bottom room
 * so the dock never occludes it.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Topbar navOpen={navOpen} onOpenNav={() => setNavOpen(true)} />

      <main id="main-content" className="flex-1">
        <div className="pb-28 lg:pb-28 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      <CommandDock />
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
      <CommandPalette />
      <AssistantDrawer />
    </div>
  );
}

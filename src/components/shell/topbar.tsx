'use client';

import Link from 'next/link';
import { Search, Bell, Sparkles, ChevronsUpDown, Check, Menu } from 'lucide-react';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import { Avatar } from '@/components/ui/avatar';
import { useOrganizations, useCurrentUser, useNotifications } from '@/hooks/use-queries';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useCommandStore, useAssistantStore } from '@/stores/ui-store';
import { NetworkHealthWidget } from '@/features/network/NetworkHealthWidget';

interface TopbarProps {
  /** Opens the mobile navigation drawer. */
  onOpenNav: () => void;
}

/**
 * The workspace utility bar: brand, org switcher, global command trigger, AI
 * assistant, notifications, and the account menu. Primary navigation lives in
 * the floating {@link CommandDock} (desktop) and the {@link MobileNav} drawer.
 */
export function Topbar({ onOpenNav }: TopbarProps) {
  const orgsQuery = useOrganizations();
  const userQuery = useCurrentUser();
  const notificationsQuery = useNotifications();

  const activeOrgId = usePreferencesStore((s) => s.activeOrgId);
  const setActiveOrg = usePreferencesStore((s) => s.setActiveOrg);
  const openCommand = useCommandStore((s) => s.setOpen);
  const openAssistant = useAssistantStore((s) => s.setOpen);

  const orgs = orgsQuery.data ?? [];
  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];
  const user = userQuery.data;
  const unread = (notificationsQuery.data ?? []).filter((n) => !n.read).length;

  const orgItems: DropdownItem[] = orgs.map((org) => ({
    label: org.name,
    icon: org.id === (activeOrg?.id ?? '') ? <Check className="h-3.5 w-3.5 text-gold" /> : undefined,
    onSelect: () => setActiveOrg(org.id),
  }));

  const accountItems: (DropdownItem | 'separator')[] = [
    { label: 'Settings', href: '/settings' },
    { label: 'Developers', href: '/developers' },
    'separator',
    { label: 'Sign out', href: '/', destructive: true },
  ];

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-border bg-background/95 backdrop-blur-xl">
      {/* Top Tier: Brand & Global Actions */}
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Link href="/overview" className="flex items-center gap-2.5 mr-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button bg-accent-gradient text-white shadow-gold">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="hidden sm:inline-block font-display text-lg font-semibold tracking-tight">Astroid</span>
        </Link>

        {/* Mobile nav trigger */}
        <button
          type="button"
          onClick={onOpenNav}
          className="grid h-9 w-9 place-items-center rounded-button text-foreground-secondary transition-colors duration-fast hover:bg-surface-secondary hover:text-foreground lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        {/* Org switcher */}
        <Dropdown
          align="start"
          trigger={
            <span className="flex items-center gap-2 rounded-button px-2.5 py-1.5 text-sm font-medium transition-colors duration-fast hover:bg-surface-secondary">
              <span className="grid h-6 w-6 place-items-center rounded-xs bg-accent-gradient text-2xs font-bold text-white">
                {(activeOrg?.name ?? 'A').charAt(0)}
              </span>
              <span className="max-w-[140px] truncate hidden sm:inline-block">{activeOrg?.name ?? 'Astroid'}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-foreground-muted" aria-hidden />
            </span>
          }
          items={orgItems}
        />

        <div className="flex-1" />

        {/* Command palette trigger */}
        <button
          type="button"
          onClick={() => openCommand(true)}
          className="hidden items-center gap-2 rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground-muted transition-colors duration-fast hover:border-border-strong hover:text-foreground-secondary md:flex"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span>Search command…</span>
          <kbd className="rounded-xs border border-border bg-surface-secondary px-1.5 py-0.5 font-mono text-2xs">
            ⌘K
          </kbd>
        </button>

        {/* Stellar Network Health & RPC Latency Widget */}
        <NetworkHealthWidget />

        {/* Assistant */}
        <button
          type="button"
          onClick={() => openAssistant(true)}
          className="grid h-9 w-9 place-items-center rounded-button text-gold transition-colors duration-fast hover:bg-gold-soft"
          aria-label="Open AI assistant"
        >
          <Sparkles className="h-[18px] w-[18px]" aria-hidden />
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative grid h-9 w-9 place-items-center rounded-button text-foreground-secondary transition-colors duration-fast hover:bg-surface-secondary hover:text-foreground"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-xs bg-gold px-1 text-[10px] font-bold text-background-secondary">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>

        {/* Account */}
        <Dropdown
          trigger={
            <span className="ml-1 flex items-center gap-2 rounded-md transition-opacity duration-fast hover:opacity-80">
              <Avatar name={user?.name ?? 'User'} src={user?.avatar} size="sm" />
            </span>
          }
          items={accountItems}
        />
      </div>
    </header>
  );
}

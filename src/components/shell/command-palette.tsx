'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Sparkles, Moon, Sun, X, Bot, WalletCards, ShieldCheck } from 'lucide-react';
import { navSections } from '@/lib/nav';
import { useCommandStore, useAssistantStore } from '@/stores/ui-store';
import { useThemeStore } from '@/stores/theme-store';
import { useAgents, useWallets } from '@/hooks/use-queries';

/**
 * Global ⌘K command palette. Fuzzy-searches every navigation destination and a
 * few quick actions (open assistant, toggle theme). Bound to ⌘K / Ctrl+K.
 */
export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const open = useCommandStore((s) => s.open);
  const returnFocusTarget = useCommandStore((s) => s.returnFocusTarget);
  const setOpen = useCommandStore((s) => s.setOpen);
  const toggleCommand = useCommandStore((s) => s.toggle);
  const openAssistant = useAssistantStore((s) => s.setOpen);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const agentsQuery = useAgents();
  const walletsQuery = useWallets();
  const agents = agentsQuery.data ?? [];
  const wallets = walletsQuery.data ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommand();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleCommand]);

  useEffect(() => {
    if (!open) return;
    const focusInput = () => dialogRef.current?.querySelector<HTMLInputElement>('[cmdk-input]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [cmdk-item]:not([aria-disabled="true"])',
      )).filter((element) => element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        event.preventDefault();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    requestAnimationFrame(focusInput);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (returnFocusTarget && document.contains(returnFocusTarget)) returnFocusTarget.focus();
    };
  }, [open, returnFocusTarget, setOpen]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-background/60 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <Command
        ref={dialogRef}
        label="Command palette"
        className="glass w-full max-w-xl overflow-hidden rounded-dialog shadow-soft-3"
        onClick={(e) => e.stopPropagation()}
        loop
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        aria-describedby="command-palette-description"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4">
          <div className="flex items-center gap-3 flex-1">
            <Search className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
            <Command.Input
              autoFocus
              aria-label="Search pages and actions"
              placeholder="Search pages and actions…"
              className="h-14 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted"
            />
          </div>
          <button
            type="button"
            aria-label="Close command palette"
            onClick={() => setOpen(false)}
            className="rounded-sm p-1 text-foreground-secondary transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p id="command-palette-description" className="sr-only">
          Search application pages and invoke quick actions with keyboard navigation.
        </p>
        <Command.List
          className="max-h-[52vh] overflow-y-auto p-2"
          aria-label="Command palette results"
        >
          <Command.Empty className="px-3 py-8 text-center text-xs text-foreground-secondary">
            No results found.
          </Command.Empty>

          <Command.Group
            heading="Actions"
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-foreground-muted"
          >
            <PaletteItem
              onSelect={() => run(() => openAssistant(true))}
              icon={<Sparkles className="h-4 w-4 text-gold" />}
              label="Ask the AI assistant"
              description="Open the assistant panel"
            />
            <PaletteItem
              onSelect={() => run(() => setMode(mode === 'dark' ? 'light' : 'dark'))}
              icon={
                mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
              }
              label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              description="Toggle the app theme"
            />
            <PaletteItem
              onSelect={() => run(() => router.push('/agents'))}
              icon={<Bot className="h-4 w-4 text-foreground-secondary" aria-hidden />}
              label="Configure an agent"
              description="Open agent configuration"
            />
            <PaletteItem
              onSelect={() => run(() => router.push('/approvals'))}
              icon={<ShieldCheck className="h-4 w-4 text-foreground-secondary" aria-hidden />}
              label="Review pending approvals"
              description="Open the approval queue"
            />
          </Command.Group>

          <Command.Group heading="Navigation" className={GROUP_CLASS}>
            {navSections.flatMap((section) => section.items.map((item) => {
              const Icon = item.icon;
              return (
                <PaletteItem
                  key={item.href}
                  value={`Navigation ${section.heading} ${item.label}`}
                  onSelect={() => run(() => router.push(item.href))}
                  icon={<Icon className="h-4 w-4 text-foreground-secondary" />}
                  label={item.label}
                  description={`${section.heading} page`}
                />
              );
            }))}
          </Command.Group>

          <Command.Group heading="Agents" className={GROUP_CLASS}>
            {agents.filter((agent) => agent.status === 'active').map((agent) => (
              <PaletteItem
                key={agent.id}
                value={`Agents ${agent.name} ${agent.role} ${agent.provider} ${agent.model}`}
                onSelect={() => run(() => router.push(`/agents/${agent.id}`))}
                icon={<Bot className="h-4 w-4 text-foreground-secondary" aria-hidden />}
                label={agent.name}
                description={`${agent.provider} · ${agent.model}`}
              />
            ))}
          </Command.Group>

          <Command.Group heading="Wallets" className={GROUP_CLASS}>
            {wallets.map((wallet) => (
              <PaletteItem
                key={wallet.id}
                value={`Wallets ${wallet.name} ${wallet.stellarAddress} ${wallet.walletType}`}
                onSelect={() => run(() => router.push(`/wallets/${wallet.id}`))}
                icon={<WalletCards className="h-4 w-4 text-foreground-secondary" aria-hidden />}
                label={wallet.name}
                description={`${wallet.stellarAddress.slice(0, 6)}...${wallet.stellarAddress.slice(-4)} · ${wallet.network}`}
              />
            ))}
          </Command.Group>

        </Command.List>
      </Command>
    </div>
  );
}

const GROUP_CLASS =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-foreground-muted';

function PaletteItem({
  label,
  icon,
  onSelect,
  value,
  description,
}: {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  value?: string;
  description?: string;
}) {
  return (
    <Command.Item
      value={value ?? label}
      onSelect={onSelect}
      aria-label={label}
      title={description ?? label}
      className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors duration-fast data-[selected=true]:bg-surface-secondary"
    >
      {icon}
      <span>{label}</span>
    </Command.Item>
  );
}

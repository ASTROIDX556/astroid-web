'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Bot,
  FileCheck2,
  Loader2,
  Moon,
  Search,
  SearchX,
  Shield,
  Sparkles,
  Sun,
  Wallet,
  X,
} from 'lucide-react';
import { navItems } from '@/lib/nav';
import { useAgents, usePolicies, useProposals, useWallets } from '@/hooks/use-queries';
import { useAssistantStore, useCommandStore } from '@/stores/ui-store';
import { useThemeStore } from '@/stores/theme-store';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';

const GROUP_CLASS =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-foreground-muted';

const ITEM_CLASS =
  'group flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors duration-fast data-[selected=true]:bg-surface-secondary data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60';

/**
 * Global command palette (⌘K / Ctrl+K) for navigation and entity search.
 *
 * The shortcut listener is registered once at the app shell with capture so it
 * beats native browser search/inputs, then `preventDefault` stops the browser's
 * default address-bar shortcut. Results are grouped into Navigation, Wallets,
 * Agents, Policies and Proposals, and cmdk handles arrow-key navigation + Enter.
 * Entity queries only mount while the dialog is open, so the palette adds no
 * background requests while it is closed.
 */
export function CommandPalette() {
  const open = useCommandStore((s) => s.open);
  const setOpen = useCommandStore((s) => s.setOpen);
  const toggle = useCommandStore((s) => s.toggle);
  const pathname = usePathname();
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Capture the trigger the moment the palette opens — before the dialog
  // mounts and moves focus into its input — so focus can be restored on close.
  useEffect(() => {
    const unsubscribe = useCommandStore.subscribe((state, previousState) => {
      if (state.open && !previousState.open) {
        previouslyFocusedRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
    });
    return unsubscribe;
  }, []);

  // Give focus back to whatever opened the palette once it closes.
  useEffect(() => {
    if (!open) return undefined;
    return () => {
      const previouslyFocused = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (
        previouslyFocused &&
        previouslyFocused !== document.body &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'k') return;
      if (event.isComposing || event.repeat) return;

      // Claim the shortcut before the browser/address bar or page inputs can.
      event.preventDefault();
      event.stopPropagation();
      toggle();
    };

    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [toggle]);

  // Navigating away should always leave the palette closed.
  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return <CommandPaletteDialog onClose={() => setOpen(false)} />;
}

function CommandPaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const agentsQuery = useAgents();
  const policiesQuery = usePolicies();
  const proposalsQuery = useProposals();
  const walletsQuery = useWallets();
  const openAssistant = useAssistantStore((s) => s.setOpen);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const agents = agentsQuery.data ?? [];
  const policies = policiesQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];
  const wallets = walletsQuery.data ?? [];

  const navigate = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <Command.Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      label="Search Astroid pages and entities"
      loop
      overlayClassName="fixed inset-0 z-[100] animate-fade-in bg-foreground/40 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-[101] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 animate-fade-up overflow-hidden rounded-dialog border border-border bg-surface shadow-soft-3"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
        <Command.Input
          autoFocus
          aria-label="Search pages, wallets, agents, policies and proposals"
          placeholder="Search pages, wallets, agents, policies, proposals…"
          className="h-14 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted"
        />
        <kbd className="px-1.5 py-0.5 hidden shrink-0 rounded-xs border border-border bg-surface-secondary font-mono text-2xs text-foreground-muted sm:inline-block">
          esc
        </kbd>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close command palette"
          className="rounded-sm p-1 text-foreground-secondary transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <Command.List
        className="max-h-[min(60vh,32rem)] overflow-y-auto p-2"
        aria-label="Command palette results"
      >
        <Command.Empty className="flex flex-col items-center gap-2 px-3 py-10 text-center">
          <SearchX className="h-6 w-6 text-foreground-muted" aria-hidden />
          <p className="text-sm font-medium text-foreground">No results found</p>
          <p className="max-w-xs text-2xs text-foreground-secondary">
            Try a page name, a wallet, an agent, a policy, or a proposal title. You can
            also clear the search to browse everything.
          </p>
        </Command.Empty>

        <Command.Group heading="Actions" className={GROUP_CLASS}>
          <PaletteItem
            value="Ask the AI assistant open chat"
            keywords={['ai', 'assistant', 'chat', 'briefing']}
            onSelect={() => {
              onClose();
              openAssistant(true);
            }}
            icon={<Sparkles className="h-4 w-4 text-gold" aria-hidden />}
            label="Ask the AI assistant"
            description="Open the financial briefing assistant"
          />
          <PaletteItem
            value={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
            keywords={['theme', 'appearance', 'dark', 'light']}
            onSelect={() => {
              onClose();
              setMode(mode === 'dark' ? 'light' : 'dark');
            }}
            icon={
              mode === 'dark' ? (
                <Sun className="h-4 w-4 text-foreground-secondary" aria-hidden />
              ) : (
                <Moon className="h-4 w-4 text-foreground-secondary" aria-hidden />
              )
            }
            label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            description="Toggle the app theme"
          />
        </Command.Group>

        <Command.Group heading="Navigation" className={GROUP_CLASS}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <PaletteItem
                key={item.href}
                value={`Navigation ${item.label} ${item.href}`}
                keywords={['page', 'go to', item.href]}
                onSelect={() => navigate(item.href)}
                icon={
                  <Icon className="h-4 w-4 text-foreground-secondary" aria-hidden />
                }
                label={item.label}
                description={`${item.href} · navigate`}
              />
            );
          })}
        </Command.Group>

        <Command.Group heading="Wallets" className={GROUP_CLASS}>
          {walletsQuery.isPending ? (
            <LoadingItem label="Loading wallets…" />
          ) : wallets.length === 0 ? (
            <EmptyGroupItem label="No wallets indexed yet" />
          ) : (
            wallets.map((wallet) => (
              <PaletteItem
                key={wallet.id}
                value={`Wallet ${wallet.name} ${wallet.id} ${wallet.stellarAddress}`}
                keywords={[
                  'wallet',
                  wallet.name,
                  wallet.walletType,
                  wallet.network,
                  wallet.status,
                ]}
                onSelect={() => navigate(`/wallets/${wallet.id}`)}
                icon={
                  <Wallet className="h-4 w-4 text-foreground-secondary" aria-hidden />
                }
                label={wallet.name}
                description={`${wallet.walletType} wallet · ${wallet.status} · ${wallet.network} · ${formatCurrency(
                  wallet.totalUsdValue,
                  'USDC',
                  { compact: true },
                )}`}
              />
            ))
          )}
        </Command.Group>

        <Command.Group heading="Agents" className={GROUP_CLASS}>
          {agentsQuery.isPending ? (
            <LoadingItem label="Loading agents…" />
          ) : agents.length === 0 ? (
            <EmptyGroupItem label="No agents indexed yet" />
          ) : (
            agents.map((agent) => (
              <PaletteItem
                key={agent.id}
                value={`Agent ${agent.name} ${agent.id} ${agent.role} ${agent.status}`}
                keywords={[
                  'agent',
                  agent.name,
                  agent.model,
                  agent.provider,
                  agent.role,
                ]}
                onSelect={() => navigate(`/agents/${agent.id}`)}
                icon={<Bot className="h-4 w-4 text-foreground-secondary" aria-hidden />}
                label={agent.name}
                description={`${agent.role} agent · ${agent.status} · ${agent.model}`}
              />
            ))
          )}
        </Command.Group>

        <Command.Group heading="Policies" className={GROUP_CLASS}>
          {policiesQuery.isPending ? (
            <LoadingItem label="Loading policies…" />
          ) : policies.length === 0 ? (
            <EmptyGroupItem label="No policies indexed yet" />
          ) : (
            policies.map((policy) => (
              <PaletteItem
                key={policy.id}
                value={`Policy ${policy.name} ${policy.id} ${policy.type}`}
                keywords={['policy', policy.name, policy.type, policy.description]}
                onSelect={() => navigate(`/policies/${policy.id}`)}
                icon={
                  <Shield className="h-4 w-4 text-foreground-secondary" aria-hidden />
                }
                label={policy.name}
                description={`${policy.type.replace(/_/g, ' ')} · ${
                  policy.enabled ? 'enabled' : 'disabled'
                } · ${policy.appliesTo} agents`}
              />
            ))
          )}
        </Command.Group>

        <Command.Group heading="Proposals" className={GROUP_CLASS}>
          {proposalsQuery.isPending ? (
            <LoadingItem label="Loading proposals…" />
          ) : proposals.length === 0 ? (
            <EmptyGroupItem label="No proposals indexed yet" />
          ) : (
            proposals.map((proposal) => (
              <PaletteItem
                key={proposal.id}
                value={`Proposal ${proposal.title} ${proposal.id} ${proposal.agentName} ${proposal.status}`}
                keywords={[
                  'proposal',
                  'approval',
                  proposal.title,
                  proposal.agentName,
                  proposal.counterparty,
                  proposal.status,
                ]}
                onSelect={() => navigate(`/approvals/${proposal.id}`)}
                icon={
                  <FileCheck2
                    className="h-4 w-4 text-foreground-secondary"
                    aria-hidden
                  />
                }
                label={proposal.title}
                description={`${proposal.status} · ${proposal.agentName} · ${formatCurrency(
                  proposal.amount,
                  proposal.asset,
                )}`}
              />
            ))
          )}
        </Command.Group>
      </Command.List>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-2xs text-foreground-muted">
        <span className="gap-1.5 inline-flex items-center">
          <Wallet className="h-3 w-3" aria-hidden />
          Wallets, agents, policies and proposals are searchable by name and status.
        </span>
        <span className="inline-flex items-center gap-2">
          <kbd className="py-0.5 rounded-xs border border-border bg-surface-secondary px-1 font-mono">
            ↑↓
          </kbd>
          navigate
          <kbd className="py-0.5 rounded-xs border border-border bg-surface-secondary px-1 font-mono">
            ↵
          </kbd>
          open
        </span>
      </div>
    </Command.Dialog>
  );
}

function PaletteItem({
  value,
  keywords,
  label,
  description,
  icon,
  onSelect,
}: {
  value: string;
  keywords?: string[];
  label: string;
  description?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      aria-label={description ? `${label} — ${description}` : label}
      className={ITEM_CLASS}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-surface-secondary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {description && (
          <span className="block truncate text-2xs text-foreground-muted">
            {description}
          </span>
        )}
      </span>
    </Command.Item>
  );
}

function LoadingItem({ label }: { label: string }) {
  return (
    <Command.Item value={`__loading ${label}`} disabled className={ITEM_CLASS}>
      <Loader2 className="h-4 w-4 animate-spin text-foreground-muted" aria-hidden />
      <span className="text-2xs text-foreground-muted">{label}</span>
    </Command.Item>
  );
}

function EmptyGroupItem({ label }: { label: string }) {
  return (
    <Command.Item
      value={`__empty ${label}`}
      disabled
      className={cn(ITEM_CLASS, 'py-2')}
    >
      <span className="text-2xs text-foreground-muted">{label}</span>
    </Command.Item>
  );
}

export default CommandPalette;

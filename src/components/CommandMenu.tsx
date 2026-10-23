'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Bot, Moon, Search, ShieldCheck, Sparkles, Sun, X } from 'lucide-react';

import { useAgents } from '@/hooks/use-queries';
import { navSections } from '@/lib/nav';
import { useAssistantStore, useCommandStore } from '@/stores/ui-store';
import { useThemeStore } from '@/stores/theme-store';
import { agentCommandValue, isCommandMenuShortcut } from './commandMenuUtils';

const GROUP_CLASS =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-foreground-muted';

const ITEM_CLASS =
  'flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-fast data-[selected=true]:bg-surface-secondary data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50';

/**
 * Global command menu (⌘K / Ctrl+K) built on cmdk.
 *
 * Radix's dialog primitive — used through `Command.Dialog` — supplies the
 * focus trap, Escape handling, focus restoration and screen-reader dialog
 * semantics. This component adds the app-wide shortcut, navigation routes,
 * live agent results and quick actions.
 */
export function CommandMenu() {
  const router = useRouter();
  const open = useCommandStore((state) => state.open);
  const setOpen = useCommandStore((state) => state.setOpen);
  const toggleCommand = useCommandStore((state) => state.toggle);
  const openAssistant = useAssistantStore((state) => state.setOpen);
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const agents = useAgents();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isCommandMenuShortcut(event)) return;
      event.preventDefault();
      toggleCommand();
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleCommand]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const agentResults = agents.data ?? [];
  const destinationCount = navSections.reduce(
    (total, section) => total + section.items.length,
    0,
  );

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {open
          ? `Command menu open. ${destinationCount} destinations and ${agentResults.length} agents available.`
          : ''}
      </p>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command menu"
        aria-describedby="command-menu-help"
        loop
        overlayClassName="fixed inset-0 z-[60] animate-fade-in bg-background/60 backdrop-blur-sm"
        contentClassName="glass fixed left-1/2 top-[12vh] z-[61] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 animate-fade-up overflow-hidden rounded-dialog shadow-soft-3"
      >
        <p id="command-menu-help" className="sr-only">
          Search navigation destinations, agents and quick actions. Use the up and down
          arrow keys to navigate, Enter to select, and Escape to close.
        </p>

        <div className="flex items-center justify-between gap-3 border-b border-border px-4">
          <div className="flex flex-1 items-center gap-3">
            <Search className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
            <Command.Input
              autoFocus
              aria-label="Search commands, pages and agents"
              placeholder="Search pages, agents, or actions…"
              className="h-14 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted"
            />
          </div>
          <button
            type="button"
            aria-label="Close command menu"
            onClick={() => setOpen(false)}
            className="rounded-sm p-1 text-foreground-secondary transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <Command.List
          className="max-h-[52vh] overflow-y-auto p-2"
          aria-label="Command menu results"
        >
          <Command.Empty className="px-3 py-8 text-center text-xs text-foreground-secondary">
            No matching pages, agents, or actions.
          </Command.Empty>

          <Command.Group heading="Quick actions" className={GROUP_CLASS}>
            <PaletteItem
              value="action ask ai assistant"
              keywords={['chat', 'copilot']}
              onSelect={() => run(() => openAssistant(true))}
              icon={<Sparkles className="h-4 w-4 text-gold" aria-hidden />}
              label="Ask the AI assistant"
              description="Open the assistant panel"
            />
            <PaletteItem
              value="action review approvals"
              keywords={['pending', 'sign', 'quorum']}
              onSelect={() => run(() => router.push('/approvals'))}
              icon={
                <ShieldCheck
                  className="h-4 w-4 text-foreground-secondary"
                  aria-hidden
                />
              }
              label="Review pending approvals"
              description="Open the approval queue"
            />
            <PaletteItem
              value="action toggle theme"
              keywords={['dark', 'light', 'appearance']}
              onSelect={() => run(() => setMode(mode === 'dark' ? 'light' : 'dark'))}
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

          {agentResults.length > 0 && (
            <Command.Group heading="Agents" className={GROUP_CLASS}>
              {agentResults.map((agent) => (
                <PaletteItem
                  key={agent.id}
                  value={agentCommandValue(agent)}
                  keywords={[agent.id, agent.role, agent.status, agent.model]}
                  onSelect={() => run(() => router.push(`/agents/${agent.id}`))}
                  icon={
                    <Bot className="h-4 w-4 text-foreground-secondary" aria-hidden />
                  }
                  label={agent.name}
                  description={`${agent.role} · ${agent.status}`}
                />
              ))}
            </Command.Group>
          )}

          {navSections.map((section) => (
            <Command.Group
              key={section.heading}
              heading={section.heading}
              className={GROUP_CLASS}
            >
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <PaletteItem
                    key={item.href}
                    value={`${section.heading} ${item.label}`}
                    keywords={[item.href, item.label]}
                    onSelect={() => run(() => router.push(item.href))}
                    icon={
                      <Icon className="h-4 w-4 text-foreground-secondary" aria-hidden />
                    }
                    label={item.label}
                    description={`${section.heading} page`}
                  />
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}

function PaletteItem({
  label,
  description,
  icon,
  onSelect,
  value,
  keywords,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onSelect: () => void;
  value: string;
  keywords?: string[];
}) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      aria-label={`${label} — ${description}`}
      className={ITEM_CLASS}
    >
      {icon}
      <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <span className="truncate">{label}</span>
        <span className="truncate text-2xs text-foreground-muted">{description}</span>
      </span>
    </Command.Item>
  );
}

export default CommandMenu;

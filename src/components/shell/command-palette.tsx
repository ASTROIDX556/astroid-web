'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Sparkles, Moon, Sun, X } from 'lucide-react';
import { navSections } from '@/lib/nav';
import { useCommandStore, useAssistantStore } from '@/stores/ui-store';
import { useThemeStore } from '@/stores/theme-store';

/**
 * Global ⌘K command palette. Fuzzy-searches every navigation destination and a
 * few quick actions (open assistant, toggle theme). Bound to ⌘K / Ctrl+K.
 */
export function CommandPalette() {
  const router = useRouter();
  const open = useCommandStore((s) => s.open);
  const setOpen = useCommandStore((s) => s.setOpen);
  const toggleCommand = useCommandStore((s) => s.toggle);
  const openAssistant = useAssistantStore((s) => s.setOpen);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

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

    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, setOpen]);

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
          </Command.Group>

          {navSections.map((section) => (
            <Command.Group
              key={section.heading}
              heading={section.heading}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-foreground-muted"
            >
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <PaletteItem
                    key={item.href}
                    value={`${section.heading} ${item.label}`}
                    onSelect={() => run(() => router.push(item.href))}
                    icon={<Icon className="h-4 w-4 text-foreground-secondary" />}
                    label={item.label}
                    description={`${section.heading} page`}
                  />
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

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

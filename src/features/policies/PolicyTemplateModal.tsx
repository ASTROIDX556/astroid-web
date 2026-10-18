'use client';

import {
  CalendarClock,
  Coins,
  Gauge,
  ListChecks,
  Search,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import {
  POLICY_TEMPLATES,
  POLICY_TEMPLATE_CATEGORIES,
  type PolicyTemplate,
  type PolicyTemplateCategory,
  type PolicyTemplateIconName,
} from './policyTemplates';

/** Lucide icon registry for template items (iconName comes from data). */
const TEMPLATE_ICONS: Record<PolicyTemplateIconName, LucideIcon> = {
  gauge: Gauge,
  'shield-list': ListChecks,
  users: Users,
  'calendar-clock': CalendarClock,
  coins: Coins,
};

export interface PolicyTemplateModalProps {
  open: boolean;
  onClose: () => void;
  /** Fired when the operator selects a template; the parent populates its form. */
  onApply: (template: PolicyTemplate) => void;
  /** Template catalogue; defaults to the built-in library. */
  templates?: PolicyTemplate[];
}

const FOCUSABLE_ITEM_SELECTOR = '[data-template-item]';

/**
 * Searchable, categorized library of pre-built spending policy templates.
 *
 * Accessibility: rendered inside the shared `Dialog` (role="dialog",
 * aria-modal, labelled by its title, Escape to close, focus trapped inside and
 * restored to the trigger on close). Templates are grouped by category and
 * exposed as a `role="list"` of buttons; Arrow keys / Home / End move focus
 * between items, and the filtered result count is announced via aria-live.
 */
export function PolicyTemplateModal({
  open,
  onClose,
  onApply,
  templates = POLICY_TEMPLATES,
}: PolicyTemplateModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PolicyTemplateCategory | 'All'>('All');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset the search each time the library opens so returning users start fresh.
  useEffect(() => {
    if (open) {
      setQuery('');
      setCategory('All');
    }
  }, [open]);

  // Give the search field keyboard focus once the dialog panel exists. The
  // Dialog's own trap focuses the panel during its effect, so this lands after
  // it on the next frame and does not fight the trap.
  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      templates.filter((template) => {
        if (category !== 'All' && template.category !== category) return false;
        if (!normalizedQuery) return true;
        return (
          template.name.toLowerCase().includes(normalizedQuery) ||
          template.description.toLowerCase().includes(normalizedQuery) ||
          template.category.toLowerCase().includes(normalizedQuery) ||
          template.highlights.some((highlight) =>
            highlight.toLowerCase().includes(normalizedQuery),
          )
        );
      }),
    [templates, category, normalizedQuery],
  );

  const grouped = useMemo(() => {
    const ordered: { category: PolicyTemplateCategory; items: PolicyTemplate[] }[] = [];
    for (const cat of POLICY_TEMPLATE_CATEGORIES) {
      const items = filtered.filter((template) => template.category === cat);
      if (items.length > 0) ordered.push({ category: cat, items });
    }
    return ordered;
  }, [filtered]);

  const handleListKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_ITEM_SELECTOR),
    );
    if (items.length === 0) return;
    const active = document.activeElement;
    const index = items.findIndex((item) => item === active);

    let target: HTMLElement | undefined;
    if (event.key === 'ArrowDown') {
      target = index < 0 ? items[0] : items[(index + 1) % items.length];
    } else if (event.key === 'ArrowUp') {
      target = index < 0 ? items[items.length - 1] : items[(index - 1 + items.length) % items.length];
    } else if (event.key === 'Home') {
      target = items[0];
    } else if (event.key === 'End') {
      target = items[items.length - 1];
    }
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }, []);

  const handleApply = useCallback(
    (template: PolicyTemplate) => {
      onApply(template);
      onClose();
    },
    [onApply, onClose],
  );

  const categoriesPresent = useMemo(
    () => POLICY_TEMPLATE_CATEGORIES.filter((cat) => templates.some((t) => t.category === cat)),
    [templates],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Rule template library"
      description="Pre-built financial governance templates for autonomous agent spending. Pick one to pre-fill the policy form, then tune the limits before validating."
    >
      <div className="space-y-4">
        <Input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search templates by name, rule, or category…"
          aria-label="Search rule templates"
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
        />

        <div
          role="group"
          aria-label="Filter templates by category"
          className="flex flex-wrap gap-1.5"
        >
          {(['All', ...categoriesPresent] as const).map((option) => {
            const isActive = category === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setCategory(option)}
                aria-pressed={isActive}
                className={cn(
                  'rounded-button border px-2.5 py-1 text-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
                  isActive
                    ? 'border-gold bg-gold-soft text-foreground'
                    : 'border-border bg-surface text-foreground-secondary hover:text-foreground',
                )}
              >
                {option}
              </button>
            );
          })}
        </div>

        <p aria-live="polite" className="sr-only">
          {filtered.length === 0
            ? 'No templates match your search.'
            : `${filtered.length} template${filtered.length === 1 ? '' : 's'} available.`}
        </p>

        <div
          ref={listRef}
          onKeyDown={handleListKeyDown}
          className="max-h-[45vh] space-y-4 overflow-y-auto pr-1"
        >
          {grouped.length === 0 ? (
            <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-foreground-secondary">
              No templates match <span className="font-medium text-foreground">“{query}”</span>.
              Try a different term such as “velocity”, “whitelist”, or “budget”.
            </p>
          ) : (
            grouped.map(({ category: cat, items }) => (
              <section key={cat} aria-label={`${cat} templates`}>
                <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                  {cat}
                </p>
                <ul role="list" className="mt-2 space-y-2">
                  {items.map((template) => {
                    const Icon = TEMPLATE_ICONS[template.iconName];
                    return (
                      <li key={template.id} className="list-none">
                        <button
                          type="button"
                          data-template-item
                          onClick={() => handleApply(template)}
                          className={cn(
                            'group w-full rounded-card border border-border bg-surface-secondary/40 p-3 text-left transition-colors',
                            'hover:border-gold hover:bg-gold-soft/60',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-button border border-border bg-surface text-gold group-hover:border-gold">
                              <Icon className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-foreground">{template.name}</p>
                                <Badge variant="outline" size="sm">
                                  {template.category}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-foreground-secondary">
                                {template.description}
                              </p>
                              <ul className="mt-2 flex flex-wrap gap-1.5">
                                {template.highlights.map((highlight) => (
                                  <li key={highlight}>
                                    <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-2xs text-foreground-secondary ring-1 ring-border">
                                      {highlight}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-2 text-2xs font-medium text-gold-strong opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                                Apply template to policy form
                              </p>
                            </div>
                          </div>
                          <span className="sr-only">
                            Apply the {template.name} template from {template.category}.
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default PolicyTemplateModal;

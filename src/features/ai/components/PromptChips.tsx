'use client';

import { cn } from '@/lib/cn';
import { FINANCIAL_BRIEFING_PROMPTS, type FinancialBriefingPrompt } from '../constants';

export interface PromptChipsProps {
  /** Called with the full prompt when a chip is activated. */
  onSelect: (prompt: string) => void;
  prompts?: readonly FinancialBriefingPrompt[];
  /** Blocks activation while the assistant is streaming a response. */
  disabled?: boolean;
  /** Shows an inline status so operators know why the chips are disabled. */
  busy?: boolean;
  label?: string;
  className?: string;
}

/**
 * Horizontally scrollable quick-action bar for the AI assistant. On narrow
 * viewports the row scrolls sideways (snap points keep chips legible) and long
 * labels truncate rather than wrapping. Chips are real buttons, so Tab +
 * Enter/Space work without a custom keyboard handler; while a response is
 * streaming every chip is disabled to prevent duplicate submissions.
 */
export function PromptChips({
  onSelect,
  prompts = FINANCIAL_BRIEFING_PROMPTS,
  disabled = false,
  busy = false,
  label = 'Financial briefing quick prompts',
  className,
}: PromptChipsProps) {
  return (
    <section aria-label={label} className={cn('min-w-0', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-3xs font-bold uppercase tracking-wider text-foreground-muted">
          Quick prompts
        </span>
        {busy && (
          <span
            role="status"
            className="gap-1.5 inline-flex items-center text-2xs text-foreground-muted"
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold"
              aria-hidden
            />
            Assistant is responding…
          </span>
        )}
      </div>

      <div
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-disabled={disabled || undefined}
      >
        {prompts.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSelect(chip.prompt)}
              disabled={disabled}
              title={chip.prompt}
              aria-label={`Ask the assistant: ${chip.prompt}`}
              className={cn(
                'gap-1.5 py-1.5 inline-flex max-w-[min(16rem,78vw)] shrink-0 snap-start items-center rounded-full border border-border bg-surface-secondary px-3 text-2xs text-foreground-secondary transition-colors duration-fast',
                'hover:border-gold hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <Icon className="h-3 w-3 shrink-0 text-gold" aria-hidden />
              <span className="truncate">{chip.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default PromptChips;

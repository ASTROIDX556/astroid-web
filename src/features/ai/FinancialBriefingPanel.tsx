'use client';

import { useEffect, useRef } from 'react';
import { ArrowUpRight, Send, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import type { ChatMessage } from '@/types/domain';

export interface FinancialBriefingPrompt {
  label: string;
  prompt: string;
}

export interface FinancialBriefingPanelProps {
  messages: ChatMessage[];
  draft: string;
  suggestions: FinancialBriefingPrompt[];
  onDraftChange: (draft: string) => void;
  onSend: (message: string) => void | Promise<void>;
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function FinancialBriefingPanel({
  messages,
  draft,
  suggestions,
  onDraftChange,
  onSend,
}: FinancialBriefingPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [draft]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 p-5">
        <div
          role="log"
          aria-label="Financial briefing conversation"
          aria-live="polite"
          aria-relevant="additions text"
          className="space-y-4"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' && 'flex-row-reverse',
              )}
            >
              {message.role === 'assistant' ? (
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gold-soft font-mono text-xs text-gold"
                  aria-hidden="true"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
              ) : (
                <Avatar name="You" size="xs" />
              )}
              <div
                className={cn(
                  'p-3.5 max-w-[85%] whitespace-pre-wrap break-words rounded-card text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-accent-gradient font-medium text-background-secondary shadow-sm'
                    : 'border border-border bg-surface-secondary/60 text-foreground',
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <p className="text-2xs font-semibold uppercase text-foreground-muted">
              Suggested Actions
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => {
                    onDraftChange(suggestion.prompt);
                    textareaRef.current?.focus();
                  }}
                  className={cn(
                    'group flex items-center justify-between gap-2 rounded-button border border-border bg-surface p-3 text-left text-xs text-foreground-secondary transition-colors duration-fast hover:border-gold hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  <span>{suggestion.label}</span>
                  <ArrowUpRight
                    className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        className="sticky bottom-0 shrink-0 border-t border-border bg-surface-secondary/90 p-4 backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault();
          void onSend(draft);
        }}
        aria-label="Send a financial briefing question"
      >
        <div className="flex items-end gap-2 rounded-button border border-border bg-surface px-3 py-2 transition-colors focus-within:border-gold focus-within:ring-1 focus-within:ring-gold">
          <label className="sr-only" htmlFor="financial-briefing-prompt">
            Ask about treasury health, agent spending, or Stellar activity
          </label>
          <textarea
            ref={textareaRef}
            id="financial-briefing-prompt"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void onSend(draft);
              }
            }}
            rows={1}
            placeholder="Ask about spend, policies..."
            className="max-h-32 py-1.5 min-h-8 flex-1 resize-none overflow-y-auto bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-muted"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-button bg-accent-gradient font-semibold text-background-secondary transition-opacity duration-fast disabled:opacity-40',
              FOCUS_RING,
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

export default FinancialBriefingPanel;

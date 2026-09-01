'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Send,
  Bot,
  User,
  Zap,
  AlertCircle,
  TrendingDown,
  FileText,
  Wallet,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useAssistantStore } from '@/stores/ui-store';
import { useBriefing } from '@/hooks/use-queries';
import { cn } from '@/lib/cn';
import { env, isMockMode } from '@/lib/env';
import type { ChatMessage, QuickPromptChip } from '@/features/chat/types';

const PRESET_CHIPS: QuickPromptChip[] = [
  {
    id: 'chip-spend-briefing',
    label: 'Daily Spend Briefing',
    promptText: 'Summarize total daily spending across all AI agents and departments, highlighting any anomalies.',
    iconName: 'Zap',
  },
  {
    id: 'chip-low-balance',
    label: 'Low Balance Wallets',
    promptText: 'Identify any agent wallets approaching minimum reserve or threshold balance that need replenishment.',
    iconName: 'AlertCircle',
  },
  {
    id: 'chip-gas-fees',
    label: 'Gas Fee Optimization',
    promptText: 'Analyze current Soroban contract RPC gas fees and recommend priority fee settings for cost efficiency.',
    iconName: 'TrendingDown',
  },
  {
    id: 'chip-treasury-report',
    label: 'Treasury Health Report',
    promptText: 'Generate a comprehensive treasury health report including cash position, runway, and risk exposure.',
    iconName: 'FileText',
  },
  {
    id: 'chip-pending-approvals',
    label: 'Pending Approvals',
    promptText: 'List all pending approval requests with risk scores, amounts, and expiration timelines.',
    iconName: 'ShieldCheck',
  },
  {
    id: 'chip-wallet-audit',
    label: 'Wallet Balance Audit',
    promptText: 'Audit all agent wallet balances and flag any below 20% capacity with recommended top-up amounts.',
    iconName: 'Wallet',
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    content:
      'Welcome to the Nvidia NIM Financial Briefing Assistant. I provide concise natural language summaries of agent spending anomalies, treasury health, and pending approvals. Select a quick prompt below or ask me anything.',
    timestamp: new Date().toISOString(),
  },
];

const ICON_MAP: Record<string, React.ElementType> = {
  Zap,
  AlertCircle,
  TrendingDown,
  FileText,
  ShieldCheck,
  Wallet,
};

interface StructuredBriefing {
  totalDailySpend: number;
  currency: string;
  activeAgentsCount: number;
  lowBalanceWalletsCount: number;
  topSpenderAgent: string;
  recommendation: string;
}

interface ExtendedChatMessage extends ChatMessage {
  structuredBriefing?: StructuredBriefing;
  isStreaming?: boolean;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function FocusTrap({ children, active }: { children: React.ReactNode; active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [active]);

  return <div ref={containerRef}>{children}</div>;
}

function MessageBubble({ message }: { message: ExtendedChatMessage }) {
  const isAssistant = message.role === 'assistant';
  const isStreaming = message.isStreaming === true;

  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex items-start gap-3', isAssistant ? 'justify-start' : 'justify-end')}
    >
      {isAssistant && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-strong"
        >
          <Bot className="h-4 w-4" aria-hidden />
        </motion.div>
      )}

      <div
        className={cn(
          'space-y-2 max-w-[85%]',
          isAssistant ? 'items-start' : 'items-end',
          'flex flex-col'
        )}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'rounded-card p-3.5 leading-relaxed text-xs shadow-xs',
            isAssistant
              ? 'bg-surface-secondary border border-border text-foreground'
              : 'bg-gold text-surface-dark font-medium'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>

          {message.structuredBriefing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ delay: 0.15, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 space-y-2.5 rounded-button border border-border bg-surface p-3 text-2xs text-foreground"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="font-bold uppercase tracking-wider text-gold">Executive Summary</span>
                <span className="flex items-center gap-1.5 rounded-button border border-border bg-surface-secondary px-2 py-0.5 text-3xs text-foreground-secondary font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                  Live On-Chain
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-2xs">
                <div>
                  <span className="text-foreground-muted">Total Daily Spend:</span>
                  <p className="font-mono font-bold text-foreground">
                    {formatCurrency(message.structuredBriefing.totalDailySpend, message.structuredBriefing.currency)}
                  </p>
                </div>
                <div>
                  <span className="text-foreground-muted">Active Agents:</span>
                  <p className="font-bold text-foreground">{message.structuredBriefing.activeAgentsCount} Agents</p>
                </div>
                <div>
                  <span className="text-foreground-muted">Top Spender:</span>
                  <p className="font-semibold text-foreground truncate">{message.structuredBriefing.topSpenderAgent}</p>
                </div>
                <div>
                  <span className="text-foreground-muted">Low Balance Wallets:</span>
                  <p className="font-bold text-warning">{message.structuredBriefing.lowBalanceWalletsCount} Warning</p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 text-2xs">
                <span className="text-foreground-muted">AI Recommendation:</span>
                <p className="text-foreground font-medium italic mt-0.5">{message.structuredBriefing.recommendation}</p>
              </div>
            </motion.div>
          )}

          {isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-2xs text-foreground-muted animate-pulse mt-2"
            >
              <Loader2 className="h-3.5 w-3.5 text-gold animate-spin" aria-hidden />
              <span>Nvidia NIM is formulating insight...</span>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.15 }}
          className="px-1 text-3xs text-foreground-muted font-mono"
        >
          {formatRelativeTime(message.timestamp)}
        </motion.div>
      </div>

      {!isAssistant && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-secondary text-foreground"
        >
          <User className="h-4 w-4" aria-hidden />
        </motion.div>
      )}
    </motion.div>
  );
}

function QuickPromptChip({
  chip,
  onClick,
  disabled,
}: {
  chip: QuickPromptChip;
  onClick: () => void;
  disabled: boolean;
}) {
  const Icon = ICON_MAP[chip.iconName] || Zap;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'flex items-center gap-1.5 rounded-button border border-border bg-surface-secondary px-3 py-1.5 text-2xs text-foreground-secondary transition-colors',
        'hover:border-gold hover:text-foreground hover:bg-surface',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
      aria-label={chip.label}
    >
      <Icon className="h-3 w-3 text-gold" aria-hidden />
      <span className="truncate max-w-[140px]">{chip.label}</span>
    </motion.button>
  );
}

export function FinancialBriefingDrawer() {
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  const briefingQuery = useBriefing();

  const [messages, setMessages] = useState<ExtendedChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = window.localStorage.getItem('astroid-financial-briefing-chat');
      if (saved) {
        const parsed = JSON.parse(saved) as ExtendedChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setSeeded(true);
        }
      }
    } catch {
      // Ignore malformed local history
    }
  }, []);

  useEffect(() => {
    if (!seeded && briefingQuery.data) {
      const greetingMsg: ExtendedChatMessage = {
        id: `msg-greeting-${Date.now()}`,
        role: 'assistant',
        content: briefingQuery.data.greeting,
        timestamp: briefingQuery.data.generatedAt,
      };
      const summaryMsg: ExtendedChatMessage = {
        id: `msg-summary-${Date.now()}`,
        role: 'assistant',
        content: briefingQuery.data.summary,
        timestamp: briefingQuery.data.generatedAt,
      };
      setMessages((prev) => [...prev, greetingMsg, summaryMsg]);
      setSeeded(true);
    }
  }, [seeded, briefingQuery.data]);

  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      window.localStorage.setItem('astroid-financial-briefing-chat', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      textareaRef.current?.focus();
    }
  }, [open, messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const stamp = new Date().toISOString();
      const userMsg: ExtendedChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: stamp,
      };
      setMessages((prev) => [...prev, userMsg]);
      setDraft('');
      setIsStreaming(true);

      if (isMockMode) {
        const mockReply: ExtendedChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content:
            'I can help with that. In this preview the assistant is running in mock mode — set NEXT_PUBLIC_API_URL to connect to the live Nvidia NIM API.',
          timestamp: stamp,
        };
        setMessages((prev) => [...prev, mockReply]);
        setIsStreaming(false);
        return;
      }

      try {
        const res = await fetch(`${env.apiUrl}${env.apiVersion}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        });
        const body = await res.json();
        const reply = body?.data?.reply ?? body?.reply ?? 'No response from AI.';
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', content: reply, timestamp: new Date().toISOString() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-err-${Date.now()}`,
            role: 'assistant',
            content: 'Failed to reach the Nvidia NIM AI service. Check the API connection.',
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming]
  );

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || draft).trim();
    if (!text || isStreaming) return;
    send(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestions = briefingQuery.data?.suggestedActions?.length
    ? briefingQuery.data.suggestedActions.map((s, i) => ({
        id: `suggested-${i}`,
        label: s.label,
        promptText: s.prompt,
        iconName: 'Zap',
      }))
    : PRESET_CHIPS;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[480px] sm:max-w-[520px] flex flex-col"
            role="dialog"
            aria-label="Nvidia NIM Financial Briefing Assistant"
            aria-modal="true"
          >
            <FocusTrap active={open}>
              <div className="flex h-full flex-col bg-surface border-l border-border shadow-raised">
                <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5 bg-surface-secondary/40">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-button bg-accent-gradient text-background-secondary shadow-sm">
                      <Sparkles className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-semibold leading-tight">Financial Briefing Assistant</h3>
                      <p className="text-2xs text-foreground-secondary">Powered by Nvidia NIM</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-button text-foreground-secondary transition-colors duration-fast hover:bg-surface-secondary hover:text-foreground"
                    aria-label="Close financial briefing"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </header>

                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-5 space-y-4"
                  aria-live="polite"
                  aria-relevant="additions"
                >
                  {messages.length === 0 && !isStreaming && (
                    <div className="rounded-card border border-dashed border-border bg-surface-secondary/40 p-4 text-sm leading-relaxed text-foreground-secondary">
                      Select a quick prompt or ask about spending anomalies, treasury health, or pending approvals.
                    </div>
                  )}

                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}

                  {isStreaming && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-2xs text-foreground-muted animate-pulse"
                    >
                      <Bot className="h-4 w-4 text-gold animate-spin" aria-hidden />
                      <span>Nvidia NIM is formulating insight...</span>
                    </motion.div>
                  )}

                  {suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="space-y-2.5 pt-2"
                    >
                      <p className="text-2xs font-semibold uppercase tracking-wider text-foreground-muted">
                        Quick Prompts
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((s) => (
                          <QuickPromptChip
                            key={s.id}
                            chip={s}
                            onClick={() => handleSendMessage(s.promptText)}
                            disabled={isStreaming}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                <form
                  className="shrink-0 border-t border-border bg-surface-secondary/30 p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                >
                  <div className="relative flex items-end">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder="Ask about spend, treasury, approvals... (Enter to send)"
                      disabled={isStreaming}
                      className="w-full resize-none rounded-button border border-border bg-surface pl-3 pr-12 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold transition-colors max-h-32"
                      aria-label="Message input"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || isStreaming}
                      className="absolute right-2 bottom-2 grid h-8 w-8 place-items-center rounded-button bg-accent-gradient text-background-secondary font-semibold transition-opacity duration-fast disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </form>
              </div>
            </FocusTrap>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, Send, ArrowUpRight } from 'lucide-react';
import { useAssistantStore } from '@/stores/ui-store';
import { useAssistantSeed, useBriefing } from '@/hooks/use-queries';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { env, isMockMode } from '@/lib/env';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '@/types/domain';

const defaultSuggestions = [
  { label: 'Financial briefing', prompt: "Provide today's financial briefing and treasury health summary." },
  { label: 'Portfolio health', prompt: 'Summarize portfolio health and highlight any risk signals.' },
  { label: 'Agent activity log', prompt: 'What did agents do recently? Summarize the latest activity log.' },
  { label: 'Stellar transfer explainer', prompt: 'Explain the most recent high-value Stellar transfer in plain English.' },
];


/**
 * Slide-over AI assistant. Seeds from the mock conversation and the daily
 * briefing's suggested prompts. The live path streams from NVIDIA NIM.
 * Composer is local-only (no backend in mock mode) — sending appends an
 * optimistic user turn plus a canned acknowledgement so the interaction reads
 * end-to-end.
 */
export function AssistantDrawer() {
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  const seedQuery = useAssistantSeed();
  const briefingQuery = useBriefing();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [seeded, setSeeded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = window.localStorage.getItem('astroid-assistant-chat');
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setSeeded(true);
        }
      }
    } catch {
      // Ignore malformed local history and fall back to the seed conversation.
    }
  }, []);

  // Seed the transcript once the mock conversation resolves.
  useEffect(() => {
    if (!seeded && seedQuery.data) {
      setMessages(seedQuery.data);
      setSeeded(true);
    }
  }, [seeded, seedQuery.data]);

  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      window.localStorage.setItem('astroid-assistant-chat', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, messages]);

  useEffect(() => {
    if (open) composerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const stamp = new Date().toISOString();
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed, createdAt: stamp };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');

    if (isMockMode) {
      const mockReply: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: 'I can help with that. In this preview the assistant is running in mock mode — set NEXT_PUBLIC_API_URL to connect to the live API.',
        createdAt: stamp,
      };
      setMessages((prev) => [...prev, mockReply]);
      return;
    }

    const assistantId = `a-${Date.now()}`;
    let accumulated = '';
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await fetch(`${env.apiUrl}${env.apiVersion}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error('AI request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const event = line.trim();
          if (!event.startsWith('data:')) continue;
          const data = event.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
              );
            }
          } catch {
            // Ignore partial JSON frames and keep reading the stream.
          }
        }
      }
      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: 'No response from AI.' } : m)),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Failed to reach the AI service. Check the API connection.' }
            : m,
        ),
      );
    }
  };


  const suggestions = useMemo(
    () => briefingQuery.data?.suggestedActions?.length ? briefingQuery.data.suggestedActions : defaultSuggestions,
    [briefingQuery.data],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 flex flex-col items-end justify-end"
        >
        <div
          role="dialog"
          aria-label="AI Executive Command Terminal"
          aria-modal="false"
          className="relative flex h-[580px] max-h-[calc(100vh-120px)] w-[400px] max-w-[calc(100vw-48px)] flex-col rounded-card border border-border-strong bg-surface/95 shadow-raised backdrop-blur-xl overflow-hidden"
        >
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5 bg-surface-secondary/40">
            <span className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-button bg-accent-gradient text-background-secondary shadow-sm">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-sm font-semibold leading-tight">Command Terminal</h3>
                <p className="text-2xs text-foreground-secondary">Autonomous AI Copilot</p>
              </div>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-button text-foreground-secondary transition-colors duration-fast hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <div ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions text" className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="rounded-card border border-dashed border-border bg-surface-secondary/40 p-4 text-sm leading-relaxed text-foreground-secondary">
                Ask for a treasury summary, a budget-risk review, or a plain-English explanation of a Stellar transfer.
              </div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
              >
                {msg.role === 'assistant' ? (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gold-soft text-gold font-mono text-xs">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : (
                  <Avatar name="You" size="xs" />
                )}
                <div
                  className={cn(
                    'max-w-[85%] rounded-card p-3.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-accent-gradient text-background-secondary font-medium shadow-sm'
                      : 'border border-border bg-surface-secondary/60 text-foreground',
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown>{msg.content || '_Thinking…_'}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            ))}

            {suggestions.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <p className="text-2xs font-semibold uppercase tracking-wider text-foreground-muted">
                  Suggested Actions
                </p>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setDraft(s.prompt);
                        composerRef.current?.focus();
                      }}
                      className="group flex items-center justify-between gap-2 rounded-button border border-border bg-surface p-3 text-left text-xs text-foreground-secondary transition-all duration-fast hover:border-gold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                    >
                      <span className="truncate">{s.label}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form
            className="shrink-0 border-t border-border bg-surface-secondary/30 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <div className="flex items-end gap-2 rounded-button border border-border bg-surface px-3 py-2 focus-within:border-gold focus-within:ring-1 focus-within:ring-gold transition-colors">
              <textarea
                ref={composerRef}
                aria-label="Chat message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                rows={1}
                placeholder="Ask about spend, policies..."
                className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-foreground-muted"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-button bg-accent-gradient text-background-secondary font-semibold transition-opacity duration-fast disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </form>
        </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Bot, Zap, Maximize2, Minimize2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType, QuickPromptChip } from './types';

/* ──────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────── */

const PRESET_CHIPS: QuickPromptChip[] = [
  {
    id: 'chip-1',
    label: 'Daily Spend Briefing',
    promptText: 'Summarize total daily spending across all AI agents and departments.',
    iconName: 'Zap',
  },
  {
    id: 'chip-2',
    label: 'Low Balance Wallets',
    promptText:
      'Identify any agent wallets approaching minimum reserve or threshold balance.',
    iconName: 'AlertCircle',
  },
  {
    id: 'chip-3',
    label: 'Gas Fee Optimization',
    promptText:
      'Analyze current Soroban contract RPC gas fees and recommend priority fee settings.',
    iconName: 'TrendingDown',
  },
];

const INITIAL_MESSAGES: ChatMessageType[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content:
      'Greetings Operator! I am your Nvidia NIM Financial Assistant for the Astroid Control Plane. How can I assist with on-chain agent governance today?',
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'Here is your current executive financial briefing:',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    structuredBriefing: {
      totalDailySpend: 18750,
      currency: 'USDC',
      activeAgentsCount: 8,
      lowBalanceWalletsCount: 1,
      topSpenderAgent: 'Soroban Relayer Sentinel (8,200 USDC)',
      recommendation:
        'Replenish Soroban Relayer Sentinel wallet before next scheduled batch settlement at 18:00 UTC.',
    },
  },
];

/**
 * Mock response templates keyed by keyword match.
 * Each entry includes an optional briefing payload and action markers.
 */
function buildReply(query: string): {
  text: string;
  briefing?: ChatMessageType['structuredBriefing'];
} {
  const q = query.toLowerCase();

  if (q.includes('daily') || q.includes('spend')) {
    return {
      text: 'Daily spend summary analysis completed. All 8 active agents are operating within established daily budget envelopes.',
      briefing: {
        totalDailySpend: 24500,
        currency: 'USDC',
        activeAgentsCount: 8,
        lowBalanceWalletsCount: 0,
        topSpenderAgent: 'Auto-Sweep Treasury Bot (15,000 XLM)',
        recommendation:
          'All budget envelopes healthy. Velocity is +12% vs 7-day trailing average.',
      },
    };
  }

  if (q.includes('balance') || q.includes('wallet')) {
    return {
      text: 'Wallet balance audit: 7 of 8 agent wallets are fully funded. 1 wallet (`agt-ci-bot`) is at **15.5%** capacity.\n\n[ACTION: APPROVE_TRANSFER: Replenish 500 USDC to agt-ci-bot wallet from Treasury Reserve]',
    };
  }

  if (q.includes('gas') || q.includes('fee')) {
    return {
      text: 'Soroban RPC network congestion is currently minimal.\n\n- Base fee: **100 stroops**\n- Recommended priority: **50 stroops**\n- Estimated tx cost: **0.0001 XLM**',
    };
  }

  return {
    text: `Nvidia NIM LLM Insights: Analyzed query \`${query}\`. On-chain telemetry indicates normal agent activity across Stellar Testnet. All node endpoints responding within expected latency bounds.`,
  };
}

/* ──────────────────────────────────────────────
 * Word-by-word streaming simulation
 * ────────────────────────────────────────────── */

/** Split text into renderable chunks (words + whitespace/newlines). */
function tokenize(text: string): string[] {
  const chunks: string[] = [];
  // Match words, whitespace runs, or newlines
  const re = /(\S+|\s+|\n)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    chunks.push(m[0]);
  }
  return chunks;
}

/**
 * Pacing: short words render faster, punctuation pauses briefly.
 * Returns milliseconds to wait before revealing the next chunk.
 */
function pacingMs(chunk: string): number {
  if (chunk === '\n') return 60;
  if (chunk.trim().length === 0) return 15;
  if (/[.!?;:]$/.test(chunk)) return 180;
  if (chunk.length <= 3) return 28;
  if (chunk.length <= 6) return 38;
  return 50;
}

/* ──────────────────────────────────────────────
 * Widget Component
 * ────────────────────────────────────────────── */

export function NvidiaAssistantWidget() {
  const [messages, setMessages] = useState<ChatMessageType[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userScrolledRef = useRef(false);

  /* ── Auto-scroll ── */
  const scrollToBottom = useCallback(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Track whether the user has manually scrolled up
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledRef.current = !atBottom;
  }, []);

  useEffect(() => {
    if (!userScrolledRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
    };
  }, []);

  /* ── Streaming simulation ── */
  const simulateStream = useCallback(
    (fullText: string, briefing?: ChatMessageType['structuredBriefing']) => {
      const msgId = `ast-${Date.now()}`;
      const tokens = tokenize(fullText);
      let index = 0;

      const appendNext = () => {
        if (index >= tokens.length) {
          // Streaming complete — finalize message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    isPartial: false,
                    content: fullText,
                    structuredBriefing: briefing,
                  }
                : m,
            ),
          );
          setIsStreaming(false);
          return;
        }

        // Accumulate tokens into visible content
        const accumulated = tokens.slice(0, index + 1).join('');
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === msgId);
          if (existing) {
            return prev.map((m) =>
              m.id === msgId ? { ...m, content: accumulated } : m,
            );
          }
          // First chunk — insert the assistant message
          return [
            ...prev,
            {
              id: msgId,
              role: 'assistant' as const,
              content: accumulated,
              timestamp: new Date().toISOString(),
              isPartial: true,
            },
          ];
        });

        index++;
        streamTimerRef.current = setTimeout(
          appendNext,
          pacingMs(tokens[index - 1] ?? ''),
        );
      };

      // Start after a brief "thinking" pause
      streamTimerRef.current = setTimeout(appendNext, 400);
    },
    [],
  );

  /* ── Send message ── */
  const handleSendMessage = useCallback(
    (textToSend?: string) => {
      const text = (textToSend || inputText).trim();
      if (!text || isStreaming) return;

      const userMsg: ChatMessageType = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setIsStreaming(true);
      userScrolledRef.current = false;

      const { text: replyText, briefing } = buildReply(text);
      simulateStream(replyText, briefing);
    },
    [inputText, isStreaming, simulateStream],
  );

  /* ── Keyboard shortcut ── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  /* ── Render ── */
  return (
    <Card
      className={`flex flex-col border border-border bg-surface transition-all ${isExpanded ? 'h-[650px]' : 'h-[500px]'}`}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border bg-surface-secondary/50 p-4">
        <div className="gap-2.5 flex items-center">
          <div className="grid h-8 w-8 place-items-center rounded-button bg-gold-soft text-gold-strong shadow-gold">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                Nvidia NIM Financial AI Assistant
              </h3>
              <Badge variant="gold" size="sm" className="text-3xs font-mono">
                LLM v2.4
              </Badge>
            </div>
            <p className="text-2xs text-foreground-muted">
              Conversational intelligence &amp; executive briefings on Stellar on-chain
              telemetry
            </p>
          </div>
        </div>

        <div className="gap-1.5 flex items-center">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="grid h-7 w-7 place-items-center rounded-button text-foreground-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ── Preset Quick Chips ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-surface/80 p-3">
        <span className="text-3xs font-bold uppercase tracking-wider text-foreground-muted">
          Quick Prompts:
        </span>
        {PRESET_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleSendMessage(chip.promptText)}
            disabled={isStreaming}
            className="gap-1.5 px-2.5 flex items-center rounded-button border border-border bg-surface-secondary py-1 text-2xs text-foreground-secondary transition-colors hover:border-gold hover:text-foreground disabled:opacity-50"
          >
            <Zap className="h-3 w-3 text-gold" />
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* ── Chat Messages Stream ── */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 space-y-4 overflow-y-auto p-4 font-sans text-xs"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex animate-pulse items-center gap-2 text-2xs text-foreground-muted">
            <Bot className="h-4 w-4 animate-spin text-gold" />
            <span>Nvidia NIM LLM is formulating insight...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* ── Input Form ── */}
      <div className="border-t border-border bg-surface-secondary/40 p-3">
        <div className="relative flex items-center">
          <textarea
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Nvidia NIM Assistant (e.g. 'Summarize daily agent spending')... (Enter to send)"
            aria-label="Message Nvidia NIM Assistant"
            disabled={isStreaming}
            className="pr-12 w-full resize-none rounded-button border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isStreaming}
            className="text-surface-dark absolute right-2 grid h-7 w-7 place-items-center rounded-button bg-gold transition-opacity disabled:opacity-40"
            title="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

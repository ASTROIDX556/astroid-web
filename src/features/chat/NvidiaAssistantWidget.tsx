'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Zap,
  Maximize2,
  Minimize2,
  Copy,
  Download,
  AlertCircle,
  Check,
  Clock,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { PromptChips } from '@/features/ai/components/PromptChips';
import { cn } from '@/lib/cn';
import { MessageContent } from './MessageContent';
import type { ChatMessage, QuickPromptChip } from './types';
import { BriefingTemplateSelector } from './BriefingTemplateSelector';
import type { FinancialBriefingTemplate } from './briefingTemplates';

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

/** Lucide icon registry for quick-prompt chips (iconName comes from data). */
const CHIP_ICONS: Record<string, LucideIcon> = {
  Zap,
  AlertCircle,
  TrendingDown,
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content:
      'Greetings Operator! I am your Nvidia NIM Financial Assistant for the Astroid Control Plane. How can I assist with on-chain agent governance today?',
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    status: 'complete',
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'Here is your current executive financial briefing:',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    status: 'complete',
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

/** Respect the OS "reduce motion" preference before animating scrolls. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface AssistantReply {
  text: string;
  briefing?: ChatMessage['structuredBriefing'];
}

/** Deterministic mock replies for the Nvidia NIM demo transport. */
function buildAssistantReply(query: string): AssistantReply {
  const normalized = query.toLowerCase();

  if (normalized.includes('daily') || normalized.includes('spend')) {
    return {
      text:
        'Daily spend summary analysis completed — all 8 active agents are operating within their budget envelopes:\n\n' +
        '- Velocity is **+12%** versus the 7-day trailing average\n' +
        '- `Auto-Sweep Treasury Bot` leads outflow at 15,000 XLM\n' +
        '- No policy violations detected in the last 24h',
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

  if (normalized.includes('balance') || normalized.includes('wallet')) {
    return {
      text: 'Wallet balance audit: **7 of 8** agent wallets are fully funded. One wallet (`agt-ci-bot`) is at 15.5% capacity — top it up before the next CI batch.',
    };
  }

  if (normalized.includes('gas') || normalized.includes('fee')) {
    return {
      text:
        'Soroban RPC network congestion is currently minimal. Recommended fee settings:\n\n' +
        '```toml\nbase_fee = 100\npriority_fee = 250\nmax_fee = 1_000\n```\n\n' +
        '- Estimated inclusion: 1–2 ledgers\n' +
        '- Retry strategy: fee-bump once on timeout',
    };
  }

  return {
    text: `Nvidia NIM LLM Insights: analyzed query "${query}". On-chain telemetry indicates normal agent activity across Stellar Testnet.`,
  };
}

export function NvidiaAssistantWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeChipId, setActiveChipId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  /** False once the operator scrolls up — stops us from yanking the transcript. */
  const stickToBottomRef = useRef(true);
  const previousMessageCountRef = useRef(INITIAL_MESSAGES.length);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Any assistant turn still being typed out — drives the "generating" state. */
  const isAwaitingReply =
    isStreaming && !messages.some((message) => message.status === 'streaming');

  // Cancel in-flight mock timers if the widget unmounts mid-stream.
  useEffect(
    () => () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    },
    [],
  );

  /** One-click export: copy the briefing transcript, or download it as text. */
  const buildTranscript = useCallback(
    () =>
      messages
        .map((msg) => {
          const prefix = msg.role === 'user' ? 'You' : 'Assistant';
          const stamp = new Date(msg.timestamp).toLocaleString();
          const briefing = msg.structuredBriefing
            ? `\n  Total daily spend: ${msg.structuredBriefing.totalDailySpend} ${msg.structuredBriefing.currency}\n  Active agents: ${msg.structuredBriefing.activeAgentsCount}\n  Top spender: ${msg.structuredBriefing.topSpenderAgent}\n  Low balance wallets: ${msg.structuredBriefing.lowBalanceWalletsCount}\n  Recommendation: ${msg.structuredBriefing.recommendation}`
            : '';
          return `[${stamp}] ${prefix}: ${msg.content}${briefing}`;
        })
        .join('\n\n'),
    [messages],
  );

  const handleCopyTranscript = async () => {
    if (messages.length === 0) {
      toast.info('Nothing to export yet — start a conversation first.');
      return;
    }
    const transcript = buildTranscript();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(transcript);
      } else {
        // Fallback for environments where clipboard permissions are blocked.
        const textarea = document.createElement('textarea');
        textarea.value = transcript;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('Briefing transcript copied to clipboard');
    } catch {
      toast.error('Clipboard access was blocked. Use “Download transcript” instead.');
    }
  };

  const handleDownloadTranscript = () => {
    if (messages.length === 0) {
      toast.info('Nothing to export yet — start a conversation first.');
      return;
    }
    const blob = new Blob([buildTranscript()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `astroid-briefing-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success('Briefing transcript downloaded as text file');
  };

  /**
   * Auto-scroll follow behaviour:
   * — new bubbles glide into view with `scrollIntoView({ behavior: 'smooth' })`;
   * — streamed chunks pin the container to the bottom directly (no animation
   *   per token, which would fight itself at ~30ms cadence);
   * — scrolling up opts out entirely until the operator returns to the bottom.
   */
  const handleTranscriptScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    stickToBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < 96;
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const grew = messages.length !== previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (!stickToBottomRef.current) return;

    if (grew) {
      chatBottomRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'nearest',
      });
    } else if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreaming]);

  /** Streams the mock NIM reply token-by-token so new content appends live. */
  const startStreamingReply = (userMessageId: string, reply: AssistantReply) => {
    const assistantId = `ast-${Date.now()}`;

    setMessages((prev) => [
      ...prev.map((message) =>
        message.id === userMessageId
          ? { ...message, status: 'sent' as const }
          : message,
      ),
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        status: 'streaming',
        structuredBriefing: reply.briefing,
      },
    ]);

    const tokens = reply.text.match(/\S+\s*/g) ?? [reply.text];
    let cursor = 0;

    streamTimerRef.current = setInterval(() => {
      cursor += 1;

      if (cursor >= tokens.length) {
        if (streamTimerRef.current) clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: reply.text, status: 'complete' }
              : message,
          ),
        );
        setIsStreaming(false);
        return;
      }

      const partial = tokens.slice(0, cursor).join('');
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, content: partial } : message,
        ),
      );
    }, 32);
  };

  // Send message handler
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsStreaming(true);

    // Mock latency before the first streamed token lands.
    replyTimerRef.current = setTimeout(() => {
      replyTimerRef.current = null;
      startStreamingReply(userMsg.id, buildAssistantReply(text));
    }, 700);
  };

  /**
   * Briefing-template selection (#166): auto-populates the composer with the
   * template prompt, then dispatches it through the existing send path
   * (`handleSendMessage`, same as the quick-prompt chips below).
   */
  const handleTemplateSelect = (template: FinancialBriefingTemplate) => {
    setInputText(template.prompt);
    handleSendMessage(template.prompt);
  };

  /**
   * Chips hydrate the composer with the full briefing prompt, then submit it
   * immediately. `handleSendMessage` is a no-op while streaming, so rapid chip
   * clicks cannot enqueue duplicate turns.
   */
  const handlePromptSelect = (prompt: string) => {
    if (isStreaming) return;
    setInputText(prompt);
    handleSendMessage(prompt);
  };

  // Keyboard shortcut listener
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card
      className={`flex flex-col border border-border bg-surface transition-all ${isExpanded ? 'h-[650px]' : 'h-[500px]'}`}
    >
      {/* Header */}
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
              Conversational intelligence & executive briefings on Stellar on-chain
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

      {/* Export toolbar + financial briefing quick prompts */}
      {/* Export toolbar + Preset Quick Chips */}
      <div className="space-y-2 border-b border-border/60 bg-surface/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-3xs font-bold uppercase tracking-wider text-foreground-muted">
            Quick Prompts:
          </span>
          <div
            className="gap-1.5 flex items-center"
            role="group"
            aria-label="Export briefing transcript"
          >
            <button
              type="button"
              onClick={handleCopyTranscript}
              className="flex items-center gap-1 rounded-button border border-border bg-surface-secondary px-2 py-1 text-2xs text-foreground-secondary transition-colors hover:border-gold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Copy chat history to clipboard"
            >
              <Copy className="h-3 w-3" aria-hidden />
              <span>Copy</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadTranscript}
              className="flex items-center gap-1 rounded-button border border-border bg-surface-secondary px-2 py-1 text-2xs text-foreground-secondary transition-colors hover:border-gold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Download chat history as .txt"
            >
              <Download className="h-3 w-3" aria-hidden />
              <span>Download</span>
            </button>
          </div>
        </div>
        <PromptChips
          onSelect={handlePromptSelect}
          disabled={isStreaming}
          busy={isStreaming}
        />
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_CHIPS.map((chip) => {
            const Icon = CHIP_ICONS[chip.iconName] ?? Zap;
            const isActive = activeChipId === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleSendMessage(chip.promptText)}
                onMouseEnter={() => setActiveChipId(chip.id)}
                onMouseLeave={() => setActiveChipId(null)}
                onFocus={() => setActiveChipId(chip.id)}
                onBlur={() => setActiveChipId(null)}
                disabled={isStreaming}
                aria-pressed={isActive}
                className={cn(
                  'gap-1.5 px-2.5 flex items-center rounded-button border py-1 text-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50',
                  isActive
                    ? 'border-gold bg-gold-soft text-foreground'
                    : 'border-border bg-surface-secondary text-foreground-secondary hover:border-gold hover:text-foreground',
                )}
              >
                <Icon className="h-3 w-3 text-gold" aria-hidden />
                <span>{chip.label}</span>
              </button>
            );
          })}
          <BriefingTemplateSelector disabled={isStreaming} onSelectTemplate={handleTemplateSelect} />
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div
        ref={scrollContainerRef}
        onScroll={handleTranscriptScroll}
        className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 font-sans text-xs"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
            >
              {isAssistant && (
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-strong">
                  <Bot className="h-4 w-4" aria-hidden />
                </div>
              )}

              <div
                className={`min-w-0 max-w-[85%] space-y-2 ${isAssistant ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`p-3.5 shadow-xs overflow-hidden rounded-card text-xs leading-relaxed ${
                    isAssistant
                      ? 'border border-border bg-surface-secondary text-foreground'
                      : 'text-surface-dark bg-gold font-medium'
                  }`}
                >
                  <MessageContent content={msg.content} />

                  {/* Structured Briefing Widget */}
                  {msg.structuredBriefing && (
                    <div className="space-y-2.5 mt-3 rounded-button border border-border bg-surface p-3 text-2xs text-foreground">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="font-bold uppercase tracking-wider text-gold">
                          Executive Summary
                        </span>
                        <Badge variant="outline" size="sm">
                          Live On-Chain
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-2xs">
                        <div>
                          <span className="text-foreground-muted">
                            Total Daily Spend:
                          </span>
                          <p className="font-mono font-bold text-foreground">
                            {formatCurrency(
                              msg.structuredBriefing.totalDailySpend,
                              msg.structuredBriefing.currency,
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Active Agents:</span>
                          <p className="font-bold text-foreground">
                            {msg.structuredBriefing.activeAgentsCount} Agents
                          </p>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Top Spender:</span>
                          <p className="truncate font-semibold text-foreground">
                            {msg.structuredBriefing.topSpenderAgent}
                          </p>
                        </div>
                        <div>
                          <span className="text-foreground-muted">
                            Low Balance Wallets:
                          </span>
                          <p
                            className={cn(
                              'font-bold',
                              msg.structuredBriefing.lowBalanceWalletsCount > 0
                                ? 'text-warning'
                                : 'text-success',
                            )}
                          >
                            {msg.structuredBriefing.lowBalanceWalletsCount} Warning
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-border/50 pt-2 text-2xs">
                        <span className="text-foreground-muted">
                          AI Recommendation:
                        </span>
                        <p className="mt-0.5 font-medium italic text-foreground">
                          {msg.structuredBriefing.recommendation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message status indicator — delivery state + timestamp */}
                <div className="gap-1.5 flex items-center px-1 font-mono text-2xs text-foreground-muted">
                  <span>{formatRelativeTime(msg.timestamp)}</span>
                  {isAssistant ? (
                    msg.status === 'streaming' ? (
                      <span
                        role="status"
                        className="inline-flex items-center gap-1 text-gold-strong"
                      >
                        <span className="gap-0.5 inline-flex" aria-hidden>
                          <span className="h-1 w-1 animate-bounce rounded-full bg-gold [animation-delay:-0.3s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-gold [animation-delay:-0.15s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-gold" />
                        </span>
                        Generating
                      </span>
                    ) : null
                  ) : msg.status === 'sending' ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden />
                      Sending
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-success">
                      <Check className="h-3 w-3" aria-hidden />
                      Sent
                    </span>
                  )}
                </div>
              </div>

              {!isAssistant && (
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-secondary text-foreground">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {isAwaitingReply && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-card border border-border bg-surface-secondary/60 px-3 py-2 text-2xs text-foreground-muted"
          >
            <Bot className="h-4 w-4 text-gold" aria-hidden />
            <span className="gap-1.5 flex items-center">
              Nvidia NIM LLM is formulating insight
              <span className="gap-0.5 inline-flex" aria-hidden>
                <span className="h-1 w-1 animate-bounce rounded-full bg-gold [animation-delay:-0.3s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-gold [animation-delay:-0.15s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-gold" />
              </span>
            </span>
          </div>
        )}

        <div ref={chatBottomRef} aria-hidden />
      </div>

      {/* Input Form */}
      <div className="border-t border-border bg-surface-secondary/40 p-3">
        <div className="relative flex items-center">
          <textarea
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Nvidia NIM Assistant (e.g. 'Summarize daily agent spending')... (Enter to send)"
            disabled={isStreaming}
            className="pr-12 w-full resize-none rounded-button border border-border bg-surface py-2 pl-3 text-xs text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none"
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

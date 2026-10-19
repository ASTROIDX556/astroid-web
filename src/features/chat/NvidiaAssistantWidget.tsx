'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Maximize2,
  Minimize2,
  Copy,
  Download,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { PromptChips } from '@/features/ai/components/PromptChips';
import type { ChatMessage } from './types';

const INITIAL_MESSAGES: ChatMessage[] = [
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

export function NvidiaAssistantWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Send message handler
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsStreaming(true);

    // Mock response fallback simulating Nvidia NIM LLM response
    setTimeout(() => {
      let replyText = `Nvidia NIM LLM Insights: Analyzed query "${text}". On-chain telemetry indicates normal agent activity across Stellar Testnet.`;
      let briefing;

      if (
        text.toLowerCase().includes('daily') ||
        text.toLowerCase().includes('spend')
      ) {
        replyText =
          'Daily spend summary analysis completed. All 8 active agents are operating within established daily budget envelopes.';
        briefing = {
          totalDailySpend: 24500,
          currency: 'USDC',
          activeAgentsCount: 8,
          lowBalanceWalletsCount: 0,
          topSpenderAgent: 'Auto-Sweep Treasury Bot (15,000 XLM)',
          recommendation:
            'All budget envelopes healthy. Velocity is +12% vs 7-day trailing average.',
        };
      } else if (
        text.toLowerCase().includes('balance') ||
        text.toLowerCase().includes('wallet')
      ) {
        replyText =
          'Wallet balance audit: 7 of 8 agent wallets are fully funded. 1 wallet (agt-ci-bot) is at 15.5% capacity.';
      } else if (
        text.toLowerCase().includes('gas') ||
        text.toLowerCase().includes('fee')
      ) {
        replyText =
          'Soroban RPC network congestion is currently minimal. Recommended base fee: 100 stroops.';
      }

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toISOString(),
        structuredBriefing: briefing,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsStreaming(false);
    }, 1000);
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
      <div className="space-y-3 border-b border-border/60 bg-surface/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
      </div>

      {/* Chat Messages Stream */}
      <div
        className="flex-1 space-y-4 overflow-y-auto p-4 font-sans text-xs"
        aria-live="polite"
        aria-relevant="additions"
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
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] space-y-2 ${isAssistant ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`p-3.5 shadow-xs rounded-card text-xs leading-relaxed ${
                    isAssistant
                      ? 'border border-border bg-surface-secondary text-foreground'
                      : 'text-surface-dark bg-gold font-medium'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

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
                          <p className="font-bold text-amber-400">
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

                <div className="text-3xs px-1 font-mono text-foreground-muted">
                  {formatRelativeTime(msg.timestamp)}
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

        {isStreaming && (
          <div className="flex animate-pulse items-center gap-2 text-2xs text-foreground-muted">
            <Bot className="h-4 w-4 animate-spin text-gold" />
            <span>Nvidia NIM LLM is formulating insight...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
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

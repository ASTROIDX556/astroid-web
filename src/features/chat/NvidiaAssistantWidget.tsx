'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Zap,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import type { ChatMessage, QuickPromptChip } from './types';

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
    promptText: 'Identify any agent wallets approaching minimum reserve or threshold balance.',
    iconName: 'AlertCircle',
  },
  {
    id: 'chip-3',
    label: 'Gas Fee Optimization',
    promptText: 'Analyze current Soroban contract RPC gas fees and recommend priority fee settings.',
    iconName: 'TrendingDown',
  },
];

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

      if (text.toLowerCase().includes('daily') || text.toLowerCase().includes('spend')) {
        replyText =
          'Daily spend summary analysis completed. All 8 active agents are operating within established daily budget envelopes.';
        briefing = {
          totalDailySpend: 24500,
          currency: 'USDC',
          activeAgentsCount: 8,
          lowBalanceWalletsCount: 0,
          topSpenderAgent: 'Auto-Sweep Treasury Bot (15,000 XLM)',
          recommendation: 'All budget envelopes healthy. Velocity is +12% vs 7-day trailing average.',
        };
      } else if (text.toLowerCase().includes('balance') || text.toLowerCase().includes('wallet')) {
        replyText =
          'Wallet balance audit: 7 of 8 agent wallets are fully funded. 1 wallet (agt-ci-bot) is at 15.5% capacity.';
      } else if (text.toLowerCase().includes('gas') || text.toLowerCase().includes('fee')) {
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

  // Keyboard shortcut listener
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className={`flex flex-col border border-border bg-surface transition-all ${isExpanded ? 'h-[650px]' : 'h-[500px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4 bg-surface-secondary/50">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-button bg-gold-soft text-gold-strong shadow-gold">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                Nvidia NIM Financial AI Assistant
              </h3>
              <Badge variant="gold" size="sm" className="font-mono text-3xs">
                LLM v2.4
              </Badge>
            </div>
            <p className="text-2xs text-foreground-muted">
              Conversational intelligence & executive briefings on Stellar on-chain telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="grid h-7 w-7 place-items-center rounded-button text-foreground-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Preset Quick Chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3 bg-surface/80">
        <span className="text-3xs uppercase tracking-wider font-bold text-foreground-muted">Quick Prompts:</span>
        {PRESET_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleSendMessage(chip.promptText)}
            disabled={isStreaming}
            className="flex items-center gap-1.5 rounded-button border border-border bg-surface-secondary px-2.5 py-1 text-2xs text-foreground-secondary hover:border-gold hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Zap className="h-3 w-3 text-gold" />
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Stream */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs"
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

              <div className={`space-y-2 max-w-[85%] ${isAssistant ? 'items-start' : 'items-end'}`}>
                <div
                  className={`rounded-card p-3.5 leading-relaxed text-xs shadow-xs ${
                    isAssistant
                      ? 'bg-surface-secondary border border-border text-foreground'
                      : 'bg-gold text-surface-dark font-medium'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Structured Briefing Widget */}
                  {msg.structuredBriefing && (
                    <div className="mt-3 space-y-2.5 rounded-button border border-border bg-surface p-3 text-2xs text-foreground">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="font-bold uppercase tracking-wider text-gold">Executive Summary</span>
                        <Badge variant="outline" size="sm">
                          Live On-Chain
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-2xs">
                        <div>
                          <span className="text-foreground-muted">Total Daily Spend:</span>
                          <p className="font-mono font-bold text-foreground">
                            {formatCurrency(msg.structuredBriefing.totalDailySpend, msg.structuredBriefing.currency)}
                          </p>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Active Agents:</span>
                          <p className="font-bold text-foreground">{msg.structuredBriefing.activeAgentsCount} Agents</p>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Top Spender:</span>
                          <p className="font-semibold text-foreground truncate">{msg.structuredBriefing.topSpenderAgent}</p>
                        </div>
                        <div>
                          <span className="text-foreground-muted">Low Balance Wallets:</span>
                          <p className="font-bold text-amber-400">{msg.structuredBriefing.lowBalanceWalletsCount} Warning</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 text-2xs">
                        <span className="text-foreground-muted">AI Recommendation:</span>
                        <p className="text-foreground font-medium italic mt-0.5">{msg.structuredBriefing.recommendation}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-1 text-3xs text-foreground-muted font-mono">
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
          <div className="flex items-center gap-2 text-2xs text-foreground-muted animate-pulse">
            <Bot className="h-4 w-4 text-gold animate-spin" />
            <span>Nvidia NIM LLM is formulating insight...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-border p-3 bg-surface-secondary/40">
        <div className="relative flex items-center">
          <textarea
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Nvidia NIM Assistant (e.g. 'Summarize daily agent spending')... (Enter to send)"
            disabled={isStreaming}
            className="w-full resize-none rounded-button border border-border bg-surface pl-3 pr-12 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isStreaming}
            className="absolute right-2 grid h-7 w-7 place-items-center rounded-button bg-gold text-surface-dark disabled:opacity-40 transition-opacity"
            title="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

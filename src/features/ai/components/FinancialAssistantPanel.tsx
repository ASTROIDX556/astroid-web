'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  Sparkles,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Zap,
  Check,
  Copy,
  ChevronRight,
} from 'lucide-react';
import { ChatMessage, SendMessagePayloadSchema } from '@/types/ai';

const INITIAL_SUGGESTIONS = [
  'Summarize agent spending over the last 24 hours',
  'Flag anomalies or policy violations in recent transactions',
  'Provide a liquidity forecast for active automated vaults',
  'Show top gas-consuming operations this week',
];

const MOCK_ASSISTANT_RESPONSES: Record<string, string> = {
  default: `### 📊 Financial Intelligence Briefing

**Summary of Recent Activity:**
- **Total Inflow:** +$42,850.00 USDC
- **Total Outflow:** -$18,210.40 USDC
- **Net Position:** **+$24,639.60 USDC**

#### 🛡️ Autonomous Agent Spend Overview
* **Trading Arbitrage Agent:** Executed 14 swaps with **$1,240.20** net profit.
* **Treasury Auto-Rebalancer:** Maintained 60/40 ratio within safe slippage tolerances.
* **Fee Optimization:** Saved approx. **14.2%** on Soroban network fees.

> **Status:** All parameters within defined multi-sig spending limits. No emergency overrides triggered.`,
};

export const FinancialAssistantPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Hello! I am your **NVIDIA NIM-powered Financial Assistant**.\n\nI can analyze your autonomous agent spending, summarize transaction activity, and alert you to governance or risk events. Ask a question below or choose a quick prompt.`,
      timestamp: Date.now(),
      metadata: {
        model: 'nvidia/nemotron-4-340b-instruct',
        confidence: 0.98,
      },
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (rawContent?: string) => {
    const textToSend = rawContent || inputValue;
    const validation = SendMessagePayloadSchema.safeParse({ message: textToSend });

    if (!validation.success) {
      setErrorMessage(validation.error.errors[0]?.message || 'Invalid input');
      return;
    }

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now(),
      status: 'done',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: MOCK_ASSISTANT_RESPONSES.default,
        timestamp: Date.now(),
        status: 'done',
        metadata: {
          model: 'nvidia/nemotron-4-340b-instruct',
          confidence: 0.96,
          tokensUsed: 248,
          suggestedActions: [
            'Export PDF briefing',
            'Inspect Arbitrage agent logs',
            'Adjust risk threshold',
          ],
        },
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Session refreshed. How can I assist with your financial analytics and agent governance today?`,
        timestamp: Date.now(),
        metadata: {
          model: 'nvidia/nemotron-4-340b-instruct',
        },
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[750px] w-full max-w-5xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-xl shadow-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                NVIDIA NIM Financial Briefing
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                <Sparkles className="w-3 h-3" /> Live Inference
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Autonomous agent monitoring & financial decision support
            </p>
          </div>
        </div>

        <button
          onClick={resetChat}
          className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Reset conversation"
          aria-label="Reset conversation"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
              )}

              <div className="max-w-[80%] space-y-2">
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 rounded-bl-none border border-gray-200/60 dark:border-gray-700/50'
                  }`}
                >
                  {msg.content}
                </div>

                {!isUser && msg.metadata?.suggestedActions && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {msg.metadata.suggestedActions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(action)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-gray-700 transition-colors"
                      >
                        <ChevronRight className="w-3 h-3" />
                        {action}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`flex items-center gap-2 text-2xs text-gray-400 px-1 ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {!isUser && msg.metadata?.model && (
                    <>
                      <span>•</span>
                      <span>{msg.metadata.model}</span>
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3.5 items-start">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white flex-shrink-0 animate-pulse">
              <Zap className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl rounded-bl-none bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                Running NIM analysis...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {messages.length <= 2 && (
        <div className="px-6 py-2 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/40">
          <div className="text-2xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Suggested queries
          </div>
          <div className="flex flex-wrap gap-2">
            {INITIAL_SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(suggestion)}
                className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-gray-700 dark:text-gray-300 transition-all text-left"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {errorMessage && (
          <div className="flex items-center gap-1.5 text-red-500 text-xs mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </div>
        )}
        <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl p-2 focus-within:ring-2 focus-within:ring-indigo-500">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about financial performance, agent limits, anomalies... (Enter to send, Shift+Enter for newline)"
            className="flex-1 bg-transparent border-0 resize-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none max-h-32 min-h-[38px] py-1.5 px-2"
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinancialAssistantPanel;
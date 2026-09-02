'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import type { ChatMessage as ChatMessageType, ActionCard } from './types';

/* ──────────────────────────────────────────────
 * Action Card parsing
 * ────────────────────────────────────────────── */

const ACTION_PATTERN = /\[ACTION:\s*([A-Z_]+):\s*([^\]]+)\]/g;

function parseActions(text: string): {
  cleanText: string;
  actions: ActionCard[];
} {
  const actions: ActionCard[] = [];
  const cleanText = text.replace(ACTION_PATTERN, (_match, type, label) => {
    actions.push({
      type: type.trim(),
      label: label.trim(),
      raw: `[ACTION: ${type}: ${label}]`,
    });
    return ''; // remove marker from displayed text
  });
  return { cleanText: cleanText.trim(), actions };
}

/* ──────────────────────────────────────────────
 * Minimal Markdown Renderer
 * ────────────────────────────────────────────── */

/** Render basic markdown: bold, inline code, code blocks, unordered lists. */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let key = 0;

  for (const line of lines) {
    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={key++}
            className="my-2 overflow-x-auto rounded-button border border-border bg-surface p-3 font-mono text-2xs leading-relaxed"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Unordered list items
    if (/^\s*[-*]\s+/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, '');
      elements.push(
        <li key={key++} className="ml-4 list-disc text-xs leading-relaxed">
          {renderInline(content)}
        </li>,
      );
      continue;
    }

    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="text-xs leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  }

  return elements;
}

/** Render inline markdown: **bold**, `code`. */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, `code`, and plain text
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded-xs bg-surface-secondary font-mono text-2xs text-gold"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/* ──────────────────────────────────────────────
 * Action Card Component
 * ────────────────────────────────────────────── */

function ActionCardView({ action }: { action: ActionCard }) {
  const isApprove = action.type.includes('APPROVE');
  const isReject = action.type.includes('REJECT');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="my-2 rounded-card border border-border bg-surface p-3 shadow-soft-1"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-soft text-gold-strong">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-bold uppercase tracking-wider text-gold">
            Transaction Action Required
          </p>
          <p className="mt-1 text-xs font-medium text-foreground">{action.label}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <Button
              size="sm"
              variant={isApprove ? 'gold' : 'secondary'}
              onClick={() => {
                /* Action callback wired by parent */
              }}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant={isReject ? 'danger' : 'ghost'}
              onClick={() => {
                /* Action callback wired by parent */
              }}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
 * Streaming Cursor
 * ────────────────────────────────────────────── */

function StreamingCursor() {
  return (
    <motion.span
      className="ml-0.5 w-0.5 inline-block h-4 bg-gold align-middle"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/* ──────────────────────────────────────────────
 * Briefing Widget
 * ────────────────────────────────────────────── */

function BriefingWidget({
  briefing,
}: {
  briefing: NonNullable<ChatMessageType['structuredBriefing']>;
}) {
  return (
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
          <span className="text-foreground-muted">Total Daily Spend:</span>
          <p className="font-mono font-bold text-foreground">
            {formatCurrency(briefing.totalDailySpend, briefing.currency)}
          </p>
        </div>
        <div>
          <span className="text-foreground-muted">Active Agents:</span>
          <p className="font-bold text-foreground">
            {briefing.activeAgentsCount} Agents
          </p>
        </div>
        <div>
          <span className="text-foreground-muted">Top Spender:</span>
          <p className="truncate font-semibold text-foreground">
            {briefing.topSpenderAgent}
          </p>
        </div>
        <div>
          <span className="text-foreground-muted">Low Balance Wallets:</span>
          <p className="font-bold text-amber-400">
            {briefing.lowBalanceWalletsCount} Warning
          </p>
        </div>
      </div>

      <div className="border-t border-border/50 pt-2 text-2xs">
        <span className="text-foreground-muted">AI Recommendation:</span>
        <p className="mt-0.5 font-medium italic text-foreground">
          {briefing.recommendation}
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
 * ChatMessage (main export)
 * ────────────────────────────────────────────── */

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';

  const { cleanText, actions } = useMemo(
    () => parseActions(message.content),
    [message.content],
  );

  const renderedContent = useMemo(() => renderMarkdown(cleanText), [cleanText]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
          <div className="whitespace-pre-wrap">
            {renderedContent}
            {message.isPartial && <StreamingCursor />}
          </div>

          {/* Render action cards inline */}
          {actions.length > 0 &&
            actions.map((action, i) => <ActionCardView key={i} action={action} />)}

          {/* Structured briefing widget */}
          {message.structuredBriefing && (
            <BriefingWidget briefing={message.structuredBriefing} />
          )}
        </div>

        <div className="text-3xs px-1 font-mono text-foreground-muted">
          {formatRelativeTime(message.timestamp)}
        </div>
      </div>

      {!isAssistant && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-secondary text-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </motion.div>
  );
}

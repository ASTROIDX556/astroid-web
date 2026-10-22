'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Lightweight markdown-ish renderer for assistant chat bubbles. Supports fenced
 * code blocks (with language label + copy action), inline code, bold text and
 * ordered / unordered lists — without pulling a full markdown pipeline into the
 * client bundle. Output is composed from React nodes (never innerHTML), so
 * operator/LLM content can never inject markup.
 */

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'code'; language: string; value: string };

const CODE_FENCE = /```([\w+#.-]*)\n?([\s\S]*?)```/g;
const INLINE_TOKEN = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function splitSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of content.matchAll(CODE_FENCE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ kind: 'text', value: content.slice(cursor, index) });
    }
    segments.push({
      kind: 'code',
      language: (match[1] ?? '').trim(),
      value: (match[2] ?? '').replace(/\n$/, ''),
    });
    cursor = index + match[0].length;
  }

  if (cursor < content.length) {
    segments.push({ kind: 'text', value: content.slice(cursor) });
  }

  return segments;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(text.slice(cursor, index));

    const token = match[0];
    const key = `${keyPrefix}-t${tokenIndex}`;
    tokenIndex += 1;

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={key}
          className="py-0.5 break-all rounded-xs border border-border bg-surface px-1 font-mono text-[0.95em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    cursor = index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

interface ListBucket {
  ordered: boolean;
  items: string[];
}

function renderTextBlock(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: ListBucket | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    nodes.push(
      <p
        key={`${keyPrefix}-p${nodes.length}`}
        className="whitespace-pre-wrap break-words"
      >
        {renderInline(paragraph.join('\n'), `${keyPrefix}-p${nodes.length}`)}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((item, index) => (
      <li key={`${keyPrefix}-li${nodes.length}-${index}`} className="break-words pl-1">
        {renderInline(item, `${keyPrefix}-li${nodes.length}-${index}`)}
      </li>
    ));
    nodes.push(
      list.ordered ? (
        <ol
          key={`${keyPrefix}-ol${nodes.length}`}
          className="ml-4 list-decimal space-y-1"
        >
          {items}
        </ol>
      ) : (
        <ul key={`${keyPrefix}-ul${nodes.length}`} className="ml-4 list-disc space-y-1">
          {items}
        </ul>
      ),
    );
    list = null;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet?.[1] ?? numbered?.[1] ?? '').trim());
      continue;
    }

    flushList();

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    paragraph.push(line);
  }

  flushList();
  flushParagraph();

  return nodes;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const handleCopy = async () => {
    const text = code;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions — the snippet stays selectable.
    }
  };

  return (
    <figure className="my-2 overflow-hidden rounded-button border border-border bg-background-secondary">
      <figcaption className="py-1.5 flex items-center justify-between gap-2 border-b border-border/60 bg-surface-secondary/60 px-3">
        <span className="font-mono text-2xs uppercase tracking-wider text-foreground-muted">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={copied ? 'Code snippet copied' : 'Copy code snippet'}
          className="px-1.5 py-0.5 inline-flex items-center gap-1 rounded-xs text-2xs text-foreground-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" aria-hidden />
          ) : (
            <Copy className="h-3 w-3" aria-hidden />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </figcaption>
      <pre className="overflow-x-auto p-3 font-mono text-2xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </figure>
  );
}

export interface MessageContentProps {
  content: string;
  className?: string;
}

export function MessageContent({ content, className }: MessageContentProps) {
  const segments = splitSegments(content);

  return (
    <div className={cn('min-w-0 space-y-2 break-words', className)}>
      {segments.map((segment, index) =>
        segment.kind === 'code' ? (
          <CodeBlock
            key={`code-${index}`}
            language={segment.language}
            code={segment.value}
          />
        ) : (
          <div key={`text-${index}`} className="space-y-2">
            {renderTextBlock(segment.value, `s${index}`)}
          </div>
        ),
      )}
    </div>
  );
}

export default MessageContent;

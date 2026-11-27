'use client';

import { useId, type ReactNode } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { parseMarkdown, type BlockNode, type InlineNode } from '@/lib/markdown';

export interface NimBriefingSummaryCardProps {
  /** Markdown text returned by the Nvidia NIM briefing endpoint. */
  content?: string | null;
  /** Shows the skeleton placeholder while the briefing is being fetched. */
  loading?: boolean;
  /** Optional fetch failure; takes precedence over the empty state. */
  error?: string | null;
  title?: string;
  /** Preformatted timestamp from the API; rendered verbatim to avoid locale drift. */
  generatedAt?: string | null;
  /** When provided, the empty and error states offer a retry action. */
  onGenerate?: () => void;
  className?: string;
}

/**
 * Card-local token classes. Every color resolves through `src/styles/tokens.css`
 * (via the Tailwind theme aliases), including dark and high-contrast themes.
 */
const CARD_CLASS =
  'relative overflow-hidden rounded-card border border-gold/35 bg-surface p-5 shadow-soft-1';
const TITLE_CLASS = 'font-display text-sm font-semibold text-foreground';
const BADGE_CLASS =
  'rounded-button border border-gold/30 bg-gold-soft px-2 py-1 text-2xs font-medium text-gold-strong';
const BODY_CLASS = 'space-y-2 text-xs leading-relaxed text-foreground-secondary';
const INLINE_CODE_CLASS =
  'rounded-xs border border-gold/30 bg-gold-soft px-1 py-px font-mono text-[0.85em] text-gold-strong';
const LINK_CLASS =
  'font-medium text-gold-strong underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const HEADING_CLASS = {
  1: 'font-display text-sm font-semibold text-foreground',
  2: 'font-display text-xs font-semibold text-foreground',
  3: 'font-display text-2xs font-semibold text-foreground',
} as const;

/** Markdown inline nodes become React text/element nodes — never raw HTML. */
function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case 'text':
        return node.value;
      case 'strong':
        return (
          <strong key={key} className="font-semibold text-foreground">
            {renderInline(node.children, key)}
          </strong>
        );
      case 'em':
        return (
          <em key={key} className="italic">
            {renderInline(node.children, key)}
          </em>
        );
      case 'code':
        return (
          <code key={key} className={INLINE_CODE_CLASS}>
            {node.value}
          </code>
        );
      case 'link':
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={LINK_CLASS}
          >
            {renderInline(node.children, key)}
          </a>
        );
      default:
        return null;
    }
  });
}

function renderBlock(block: BlockNode, keyPrefix: string): ReactNode {
  switch (block.type) {
    case 'paragraph':
      return (
        <p key={keyPrefix} className="whitespace-pre-wrap break-words">
          {renderInline(block.children, keyPrefix)}
        </p>
      );
    case 'heading': {
      const Tag = (`h${Math.min(block.level + 1, 6)}`) as 'h3' | 'h4' | 'h5';
      return (
        <Tag key={keyPrefix} className={cn('leading-snug', HEADING_CLASS[block.level])}>
          {renderInline(block.children, keyPrefix)}
        </Tag>
      );
    }
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag
          key={keyPrefix}
          start={block.ordered && block.start !== 1 ? block.start : undefined}
          className={cn(
            'space-y-1 pl-5 marker:text-foreground-secondary',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, index) => (
            <li key={`${keyPrefix}-${index}`} className="break-words pl-px">
              {renderInline(item, `${keyPrefix}-${index}`)}
            </li>
          ))}
        </ListTag>
      );
    }
    case 'code':
      return (
        <pre
          key={keyPrefix}
          className="overflow-x-auto rounded-button border border-border bg-surface-secondary p-3 font-mono text-2xs text-foreground"
          aria-label={block.language ? `${block.language} code` : 'Code'}
        >
          <code>{block.value}</code>
        </pre>
      );
    default:
      return null;
  }
}

function LoadingState() {
  return (
    <div role="status" aria-label="Loading Nvidia NIM financial briefing" className="space-y-3">
      <span className="sr-only">Generating your financial briefing…</span>
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-4/5" />
    </div>
  );
}

function EmptyState({ onGenerate }: { onGenerate?: () => void }) {
  return (
    <div
      role="status"
      className="rounded-button border border-border bg-surface-secondary/50 p-4"
    >
      <FileText className="mb-2 h-5 w-5 text-gold-strong" aria-hidden />
      <p className="font-semibold text-foreground">No briefing available yet</p>
      <p className="mt-1 text-foreground-secondary">
        The Nvidia NIM service returned an empty response. Generate a briefing to see a summary here.
      </p>
      {onGenerate ? (
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onGenerate}>
          Generate briefing
        </Button>
      ) : null}
    </div>
  );
}

function ErrorState({ error, onGenerate }: { error: string; onGenerate?: () => void }) {
  return (
    <div role="alert" className="rounded-button border border-danger/40 bg-danger-soft p-4">
      <p className="font-semibold text-foreground">Briefing unavailable</p>
      <p className="mt-1 text-foreground-secondary">{error}</p>
      {onGenerate ? (
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onGenerate}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Dashboard-ready summary card for Nvidia NIM financial briefings.
 *
 * The response is parsed into the typed AST from `@/lib/markdown` and emitted
 * as React elements. No `dangerouslySetInnerHTML` is used, so model output can
 * never execute scripts or inject markup. Loading, empty, and error responses
 * each have an explicit, accessible state.
 */
export function NimBriefingSummaryCard({
  content,
  loading = false,
  error = null,
  title = 'Financial briefing',
  generatedAt,
  onGenerate,
  className,
}: NimBriefingSummaryCardProps) {
  const titleId = useId();
  const hasContent = typeof content === 'string' && content.trim().length > 0;
  const blocks =
    typeof content === 'string' && content.trim().length > 0 ? parseMarkdown(content) : [];

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={loading}
      className={cn(CARD_CLASS, className)}
    >
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 id={titleId} className={cn(TITLE_CLASS, 'flex items-center gap-2')}>
          <Sparkles className="h-4 w-4 text-gold-strong" aria-hidden />
          {title}
        </h2>
        <span className={BADGE_CLASS}>Nvidia NIM</span>
      </div>
      <div className="space-y-3">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onGenerate={onGenerate} />
        ) : !hasContent ? (
          <EmptyState onGenerate={onGenerate} />
        ) : (
          <div className={BODY_CLASS} aria-live="polite">
            {blocks.map((block, index) => renderBlock(block, `briefing-block-${index}`))}
          </div>
        )}
        {generatedAt && !loading ? (
          <p className="text-2xs text-foreground-secondary">Generated {generatedAt}</p>
        ) : null}
      </div>
    </section>
  );
}

export default NimBriefingSummaryCard;

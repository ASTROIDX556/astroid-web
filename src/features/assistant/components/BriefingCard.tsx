'use client';

import { Fragment, useId, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Minus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * Assistant financial briefing card.
 *
 * Renders the structured payload the Nvidia NIM assistant returns (summary,
 * key financial metrics, policy quick actions) with an explicit loading /
 * error / empty contract, so a briefing can live in the assistant drawer, the
 * approvals workspace, or any dashboard widget without re-implementing state.
 *
 * The summary supports a deliberately small Markdown subset — paragraphs,
 * `-`/`*` bullet lists, and `**bold**` — rendered as real React nodes rather
 * than injected HTML, so an untrusted model response can never introduce markup.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type BriefingTone = 'neutral' | 'positive' | 'warning' | 'critical';

export interface BriefingMetricDelta {
  /** Pre-formatted change, e.g. `+12.4%`. */
  value: string;
  direction: 'up' | 'down' | 'flat';
  /** When false, an increase is bad (e.g. spend) and is rendered in warning tones. */
  positive?: boolean;
}

export interface BriefingMetric {
  /** Stable key for React lists and analytics. */
  id: string;
  /** Short key, e.g. "Runway". */
  label: string;
  /** Pre-formatted value, e.g. "$48,210.00" or "6 agents". */
  value: string;
  /** Optional supporting context under the value. */
  hint?: string;
  delta?: BriefingMetricDelta;
  tone?: BriefingTone;
}

export interface BriefingAction {
  id: string;
  label: string;
  /** Prompt handed to the assistant, or context for the caller's handler. */
  prompt?: string;
  icon?: LucideIcon;
  variant?: Extract<NonNullable<ButtonProps['variant']>, 'gold' | 'secondary' | 'outline' | 'ghost'>;
  disabled?: boolean;
  /** Explains why the action is unavailable; surfaced as the button title. */
  disabledReason?: string;
  onSelect: (action: BriefingAction) => void;
}

export interface BriefingStatus {
  label: string;
  tone: BriefingTone;
}

export interface FinancialBriefingPayload {
  id?: string;
  /** Card headline, e.g. "Treasury briefing". */
  title: string;
  /** Markdown-like summary body (paragraphs, bullet lists, **bold**). */
  summary: string;
  metrics: readonly BriefingMetric[];
  actions?: readonly BriefingAction[];
  status?: BriefingStatus;
  /** ISO timestamp of when the assistant produced the briefing. */
  generatedAt?: string;
  /** Data sources the briefing was grounded in, e.g. "Stellar Horizon". */
  sources?: readonly string[];
}

export interface BriefingCardProps {
  briefing?: FinancialBriefingPayload | null;
  loading?: boolean;
  error?: string | null;
  /** Optional retry affordance for the failed load. */
  onRetry?: () => void;
  /** Opens the full assistant conversation with an optional seeded prompt. */
  onOpenAssistant?: (prompt?: string) => void;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Markdown subset                                                            */
/* -------------------------------------------------------------------------- */

export interface BriefingInlineSpan {
  text: string;
  bold: boolean;
}

export type BriefingBlock =
  | { kind: 'paragraph'; spans: BriefingInlineSpan[] }
  | { kind: 'list'; items: BriefingInlineSpan[][] };

/** Splits a line into plain and `**bold**` spans without parsing HTML. */
export function parseBriefingInline(line: string): BriefingInlineSpan[] {
  const spans: BriefingInlineSpan[] = [];

  for (const part of line.split(/(\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    const bold = part.length > 4 && part.startsWith('**') && part.endsWith('**');
    spans.push({ text: bold ? part.slice(2, -2) : part, bold });
  }

  return spans.length > 0 ? spans : [{ text: '', bold: false }];
}

/** Parses the briefing summary into paragraphs and bullet lists. */
export function parseBriefingMarkdown(source: string): BriefingBlock[] {
  const blocks: BriefingBlock[] = [];
  let paragraph: string[] = [];
  let list: BriefingInlineSpan[][] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', spans: parseBriefingInline(paragraph.join(' ')) });
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push({ kind: 'list', items: list });
    list = [];
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      list.push(parseBriefingInline(line.replace(/^[-*]\s+/, '')));
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function InlineSpans({ spans }: { spans: readonly BriefingInlineSpan[] }) {
  return (
    <>
      {spans.map((span, index) => (
        <Fragment key={`${index}-${span.text.slice(0, 12)}`}>
          {span.bold ? <strong className="font-semibold text-foreground">{span.text}</strong> : span.text}
        </Fragment>
      ))}
    </>
  );
}

export function BriefingCardMarkdown({ source }: { source: string }) {
  const blocks = parseBriefingMarkdown(source);

  return (
    <div className="space-y-2.5 text-xs leading-relaxed text-foreground-secondary">
      {blocks.map((block, index) =>
        block.kind === 'list' ? (
          <ul key={`list-${index}`} className="list-disc space-y-1 pl-4">
            {block.items.map((item, itemIndex) => (
              <li key={`item-${index}-${itemIndex}`}>
                <InlineSpans spans={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={`p-${index}`}>
            <InlineSpans spans={block.spans} />
          </p>
        ),
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tone tokens                                                                */
/* -------------------------------------------------------------------------- */

const TONE_TEXT: Record<BriefingTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-success',
  warning: 'text-warning',
  critical: 'text-danger',
};

const TONE_BADGE: Record<BriefingTone, 'outline' | 'success' | 'warning' | 'danger'> = {
  neutral: 'outline',
  positive: 'success',
  warning: 'warning',
  critical: 'danger',
};

const DELTA_ICON: Record<BriefingMetricDelta['direction'], LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

/* -------------------------------------------------------------------------- */
/* Composable pieces                                                          */
/* -------------------------------------------------------------------------- */

export interface BriefingCardHeaderProps {
  title: string;
  status?: BriefingStatus;
  generatedAt?: string;
  /** Extra controls rendered on the trailing edge of the header. */
  trailing?: ReactNode;
  className?: string;
}

export function BriefingCardHeader({
  title,
  status,
  generatedAt,
  trailing,
  className,
}: BriefingCardHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-foreground">
          <Sparkles className="h-4 w-4 shrink-0 text-gold" aria-hidden />
          <span className="truncate">{title}</span>
        </h3>
        {generatedAt && (
          <p className="mt-1 text-2xs text-foreground-muted">
            Generated{' '}
            <time dateTime={generatedAt}>{new Date(generatedAt).toLocaleString()}</time>
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {status && (
          <Badge variant={TONE_BADGE[status.tone]} size="sm" dot>
            {status.label}
          </Badge>
        )}
        {trailing}
      </div>
    </header>
  );
}

export function BriefingCardMetrics({
  metrics,
  className,
}: {
  metrics: readonly BriefingMetric[];
  className?: string;
}) {
  if (metrics.length === 0) return null;

  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3',
        className,
      )}
      aria-label="Key financial metrics"
    >
      {metrics.map((metric) => {
        const tone = metric.tone ?? 'neutral';
        const DeltaIcon = metric.delta ? DELTA_ICON[metric.delta.direction] : null;
        const deltaPositive = metric.delta
          ? (metric.delta.positive ?? metric.delta.direction !== 'down')
          : true;

        return (
          <div key={metric.id} className="min-w-0 bg-surface px-3 py-2.5">
            <dt className="truncate text-2xs font-medium uppercase tracking-wide text-foreground-muted">
              {metric.label}
            </dt>
            <dd className={cn('mt-1 truncate font-semibold tabular text-sm', TONE_TEXT[tone])}>
              {metric.value}
            </dd>
            <dd className="mt-0.5 flex min-h-[1rem] flex-wrap items-center gap-1 text-2xs">
              {metric.delta && DeltaIcon && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 font-medium',
                    deltaPositive ? 'text-success' : 'text-warning',
                  )}
                >
                  <DeltaIcon className="h-3 w-3" aria-hidden />
                  {metric.delta.value}
                </span>
              )}
              {metric.hint && <span className="text-foreground-muted">{metric.hint}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function BriefingCardActions({
  actions,
  onOpenAssistant,
  className,
}: {
  actions: readonly BriefingAction[];
  onOpenAssistant?: (prompt?: string) => void;
  className?: string;
}) {
  if (actions.length === 0 && !onOpenAssistant) return null;

  return (
    <footer
      className={cn(
        'flex flex-wrap items-center gap-2 border-t border-border bg-surface-secondary/40 px-4 py-3',
        className,
      )}
      aria-label="Briefing quick actions"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            type="button"
            size="sm"
            variant={action.variant ?? 'secondary'}
            disabled={action.disabled}
            title={action.disabled ? action.disabledReason : undefined}
            onClick={() => action.onSelect(action)}
            leftIcon={Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : undefined}
            aria-label={action.prompt ? `${action.label}: ${action.prompt}` : action.label}
          >
            {action.label}
          </Button>
        );
      })}
      {onOpenAssistant && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() =>
            onOpenAssistant(
              'Summarize treasury health, spending anomalies, and policy recommendations.',
            )
          }
          rightIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
        >
          Open assistant
        </Button>
      )}
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export function BriefingCard({
  briefing,
  loading = false,
  error = null,
  onRetry,
  onOpenAssistant,
  className,
}: BriefingCardProps) {
  const headingId = useId();
  const summaryId = useId();
  const shouldReduceMotion = useReducedMotion();

  const hasContent = Boolean(
    briefing && (briefing.summary.trim().length > 0 || briefing.metrics.length > 0),
  );

  return (
    <motion.section
      aria-labelledby={headingId}
      aria-busy={loading}
      className={cn(
        'overflow-hidden rounded-card border border-border bg-surface shadow-soft-1',
        className,
      )}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 id={headingId} className="sr-only">
        {briefing?.title ?? 'Financial briefing'}
      </h2>

      <BriefingCardHeader
        title={briefing?.title ?? 'Financial briefing'}
        status={briefing?.status}
        generatedAt={loading ? undefined : briefing?.generatedAt}
        trailing={
          briefing?.sources && briefing.sources.length > 0 ? (
            <span className="text-2xs text-foreground-muted">
              Sources: {briefing.sources.join(', ')}
            </span>
          ) : undefined
        }
      />

      <div className="space-y-4 p-4">
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading financial briefing">
            <div className="skeleton h-3.5 w-2/3 rounded-sm" />
            <div className="skeleton h-16 w-full rounded-sm" />
            <div className="skeleton h-10 w-full rounded-sm" />
          </div>
        ) : error ? (
          <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft/40 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              Briefing unavailable
            </p>
            <p className="mt-1 text-2xs leading-relaxed text-foreground-secondary">{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {onRetry && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onRetry}
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                >
                  Retry
                </Button>
              )}
              {onOpenAssistant && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenAssistant('Generate a treasury briefing for today.')}
                >
                  Ask assistant
                </Button>
              )}
            </div>
          </div>
        ) : !hasContent ? (
          <div className="flex flex-col items-start gap-2 rounded-card border border-dashed border-border bg-surface-secondary/30 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-soft text-gold">
              <Bot className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-xs font-semibold text-foreground">No briefing yet</p>
            <p className="text-2xs leading-relaxed text-foreground-secondary">
              Ask the assistant to summarize treasury health, spending anomalies, and policy
              recommendations for the current period.
            </p>
            {onOpenAssistant && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-1"
                onClick={() => onOpenAssistant('Generate today’s financial briefing.')}
              >
                Generate briefing
              </Button>
            )}
          </div>
        ) : (
          <>
            <div id={summaryId}>
              <BriefingCardMarkdown source={briefing?.summary ?? ''} />
            </div>
            <BriefingCardMetrics metrics={briefing?.metrics ?? []} />
          </>
        )}
      </div>

      {!loading && !error && (
        <BriefingCardActions
          actions={briefing?.actions ?? []}
          onOpenAssistant={onOpenAssistant}
        />
      )}
    </motion.section>
  );
}

export default BriefingCard;

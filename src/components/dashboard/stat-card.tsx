import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/motion';

// ---------------------------------------------------------------------------
// StatCard — a KPI tile wrapping StatNumber in a surface with an optional link
// ---------------------------------------------------------------------------
export interface StatCardProps {
  label: string;
  value?: string;
  rawNumber?: number;
  formatter?: (val: number) => string;
  delta?: number;
  deltaLabel?: string;
  upIsGood?: boolean;
  icon?: React.ReactNode;
  href?: string;
  footer?: React.ReactNode;
  accent?: boolean;
  className?: string;
}

/**
 * A metric tile. Oversized value dominates; an optional signed delta ships an
 * arrow + sign (never color alone) and an optional link makes the whole card a
 * navigable target.
 */
export function StatCard({
  label,
  value,
  rawNumber,
  formatter,
  delta,
  deltaLabel,
  upIsGood = true,
  icon,
  href,
  footer,
  accent = false,
  className,
}: StatCardProps) {
  const hasDelta = typeof delta === 'number';
  const positive = (delta ?? 0) >= 0;
  const good = positive === upIsGood;

  const body = (
    <Card
      elevation="soft"
      interactive={Boolean(href)}
      className={cn('flex h-full flex-col gap-4 p-5', className)}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
          {label}
        </span>
        {icon && <span className="text-foreground-muted">{icon}</span>}
      </div>
      <span
        className={cn(
          'tabular font-display text-4xl font-semibold leading-none tracking-tight',
          accent && 'text-accent-gradient',
        )}
      >
        {rawNumber !== undefined && formatter ? (
          <AnimatedNumber value={rawNumber} formatter={formatter} />
        ) : (
          value
        )}
      </span>
      <div className="mt-auto flex items-center justify-between gap-2">
        {hasDelta ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-2xs font-medium',
              good ? 'text-success' : 'text-danger',
            )}
          >
            {positive ? '▲' : '▼'} {positive ? '+' : ''}
            {delta.toFixed(1)}%
            {deltaLabel && (
              <span className="text-foreground-secondary">{deltaLabel}</span>
            )}
          </span>
        ) : (
          <span className="text-2xs text-foreground-secondary">{footer}</span>
        )}
        {href && <ArrowUpRight className="h-4 w-4 text-foreground-muted" aria-hidden />}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full focus-visible:outline-none">
        {body}
      </Link>
    );
  }
  return body;
}

// ---------------------------------------------------------------------------
// KeyValue — a labelled definition row used across detail pages
// ---------------------------------------------------------------------------
export function KeyValue({
  label,
  children,
  className,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <dt className="text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
        {label}
      </dt>
      <dd className={cn('text-sm text-foreground', mono && 'font-mono text-xs')}>
        {children}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionLabel — a small hairline-prefixed section heading
// ---------------------------------------------------------------------------
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        'font-display text-lg font-semibold tracking-tight text-foreground',
        className,
      )}
    >
      {children}
    </h2>
  );
}

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StatNumberProps {
  /** Pre-formatted value string (e.g. `$12,456,221`). Rendered oversized. */
  value: string;
  label?: string;
  /** Signed percentage change vs a named period. */
  delta?: number;
  deltaLabel?: string;
  /** Whether an upward delta is a good thing (controls color). */
  upIsGood?: boolean;
  size?: 'md' | 'lg' | 'xl' | 'hero';
  accent?: boolean;
  className?: string;
}

const sizeClass: Record<NonNullable<StatNumberProps['size']>, string> = {
  md: 'text-3xl',
  lg: 'text-4xl',
  xl: 'text-6xl',
  hero: 'text-7xl md:text-8xl',
};

/**
 * Oversized editorial metric (PRD: "Large numbers dominate"). Uses the display
 * face with proportional figures for big standalone numbers; delta uses status
 * color by direction × whether up is good, and always ships an arrow + sign so
 * meaning never rests on color alone.
 */
export function StatNumber({
  value,
  label,
  delta,
  deltaLabel,
  upIsGood = true,
  size = 'lg',
  accent = false,
  className,
}: StatNumberProps) {
  const hasDelta = typeof delta === 'number';
  const positive = (delta ?? 0) >= 0;
  const good = positive === upIsGood;
  const Arrow = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-secondary">
          {label}
        </span>
      )}
      <span
        className={cn(
          'font-display font-semibold leading-none tracking-tight',
          sizeClass[size],
          accent && 'text-accent-gradient',
        )}
      >
        {value}
      </span>
      {hasDelta && (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            good ? 'text-success' : 'text-danger',
          )}
        >
          <Arrow className="h-4 w-4" aria-hidden />
          {positive ? '+' : ''}
          {delta.toFixed(1)}%
          {deltaLabel && (
            <span className="text-foreground-secondary">{deltaLabel}</span>
          )}
        </span>
      )}
    </div>
  );
}

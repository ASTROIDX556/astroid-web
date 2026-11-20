import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Illustrated empty state — never a bare "No Data" (PRD Doc 9). Beautiful
 * illustration + a prominent CTA.
 */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface/50 text-center',
        compact ? 'gap-3 p-6' : 'gap-4 p-10',
        className,
      )}
    >
      {illustration && (
        <div className={cn('text-border-strong', compact ? 'w-16' : 'w-28')}>
          {illustration}
        </div>
      )}
      <div className="gap-1.5 flex max-w-sm flex-col">
        <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs leading-relaxed text-foreground-secondary">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

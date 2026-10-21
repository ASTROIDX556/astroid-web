import { cn } from '@/lib/cn';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Editorial page header — an optional eyebrow, an oversized display title, a
 * short lede, and a right-aligned actions slot. Used at the top of every page.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        {eyebrow && (
          <span className="text-2xs font-medium uppercase tracking-[0.14em] text-gold-strong">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="max-w-prose text-xs leading-relaxed text-foreground-secondary">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

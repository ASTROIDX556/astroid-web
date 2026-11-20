import { cn } from '@/lib/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'full';
}

/** Shimmer skeleton — always prefer over spinners for content loading. */
export function Skeleton({ className, rounded = 'sm', ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton',
        rounded === 'full'
          ? 'rounded-full'
          : rounded === 'md'
            ? 'rounded-md'
            : 'rounded-sm',
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}

/** A card-shaped skeleton used across list/grid screens. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-card border border-border bg-surface p-5', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" rounded="full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-5 h-8 w-2/3" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="w-16 h-3" />
        <Skeleton className="w-16 h-3" />
      </div>
    </div>
  );
}

/** A skeleton table body with configurable rows/columns. */
export function SkeletonTable({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-border">
      <div className="border-b border-border bg-surface-secondary/50 p-4">
        <Skeleton className="w-40 h-3" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 p-4">
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} className={cn('h-3', c === 0 ? 'w-1/4' : 'flex-1')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

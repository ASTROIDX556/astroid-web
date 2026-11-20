'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface Column<T> {
  /** Header label. */
  header: string;
  /** Cell renderer. */
  cell: (row: T) => React.ReactNode;
  /** Optional alignment; defaults to left. */
  align?: 'left' | 'right' | 'center';
  /** Optional width class (e.g. 'w-32'). */
  className?: string;
  /** Hide below the `sm` breakpoint for responsive density. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable key extractor. */
  rowKey: (row: T) => string;
  /** Navigate here on row click; makes rows interactive + keyboard-activatable. */
  rowHref?: (row: T) => string;
  compact?: boolean;
  className?: string;
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

/**
 * A restrained, editorial data table. Tabular numerals, hairline row dividers,
 * optional row navigation with full keyboard support, and a responsive
 * hide-on-mobile flag per column.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  compact = false,
  className,
}: DataTableProps<T>) {
  const router = useRouter();
  const pad = compact ? 'px-5 py-3' : 'px-6 py-4';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-card border border-border bg-surface',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary/40">
              {columns.map((col, i) => (
                <th
                  key={i}
                  scope="col"
                  className={cn(
                    'text-2xs font-medium uppercase tracking-wide text-foreground-secondary',
                    pad,
                    alignClass[col.align ?? 'left'],
                    col.hideOnMobile && 'hidden sm:table-cell',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const href = rowHref?.(row);
              const interactive = Boolean(href);
              return (
                <tr
                  key={rowKey(row)}
                  {...(interactive
                    ? {
                        role: 'link',
                        tabIndex: 0,
                        onClick: () => router.push(href as string),
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(href as string);
                          }
                        },
                      }
                    : {})}
                  className={cn(
                    'transition-colors duration-fast',
                    interactive &&
                      'cursor-pointer hover:bg-surface-secondary/50 focus-visible:bg-surface-secondary focus-visible:outline-none',
                  )}
                >
                  {columns.map((col, i) => (
                    <td
                      key={i}
                      className={cn(
                        'text-foreground',
                        pad,
                        alignClass[col.align ?? 'left'],
                        col.hideOnMobile && 'hidden sm:table-cell',
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

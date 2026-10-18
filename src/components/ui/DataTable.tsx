'use client';

import { useEffect, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export type DataTableColumn<TData> = ColumnDef<TData, unknown>;

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  getRowId?: (row: TData, index: number) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  className?: string;
  emptyState?: React.ReactNode;
  caption?: string;
  onRowClick?: (row: TData) => void;
  /**
   * Let more than one column be sorted at a time: Shift + click (or Shift + Enter
   * on the header button) appends the column instead of replacing the sort.
   */
  enableMultiSort?: boolean;
  /**
   * Projects a row onto the text the search box matches against. Defaults to the
   * visible cell values, so pass this when a column renders fields that are not
   * its own accessor (e.g. a recipient address shown under a counterparty name).
   */
  getRowSearchText?: (row: TData) => string;
}

export function DataTable<TData>({
  data,
  columns,
  getRowId,
  searchable = false,
  searchPlaceholder = 'Search rows...',
  pageSize = 10,
  className,
  emptyState,
  caption,
  onRowClick,
  enableMultiSort = false,
  getRowSearchText,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    enableMultiSort,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue ?? '').trim().toLowerCase();
      if (!search) return true;

      if (getRowSearchText) {
        return getRowSearchText(row.original).toLowerCase().includes(search);
      }

      const candidates = row
        .getVisibleCells()
        .map((cell) => cell.getValue())
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return candidates.some((value) => value.includes(search));
    },
  });

  const pageCount = table.getPageCount();
  const canPaginate = pageCount > 1;

  // Filtering — the search box or a filter applied to `data` upstream — can leave the
  // current page past the last one, which renders an empty table. Clamp it into range.
  useEffect(() => {
    setPagination((current) => {
      const lastPage = Math.max(0, pageCount - 1);
      return current.pageIndex > lastPage ? { ...current, pageIndex: lastPage } : current;
    });
  }, [pageCount]);

  // The footer counts describe the *filtered* set, so a search or an external
  // filter never leaves the reader showing "1-8 of 40" over three rows.
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const rangeStart = Math.min(pageIndex * currentPageSize + 1, filteredRowCount);
  const summary =
    filteredRowCount === 0
      ? '0 rows'
      : `${rangeStart}-${Math.min(rangeStart + currentPageSize - 1, filteredRowCount)} of ${filteredRowCount}`;

  return (
    <div className={cn('overflow-hidden rounded-card border border-border bg-surface', className)}>
      {(searchable || caption) && (
        <div className="flex flex-col gap-3 border-b border-border bg-surface-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          {caption && <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary">{caption}</p>}
          {searchable && (
            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" aria-hidden />
              <input
                aria-label="Search table rows"
                value={globalFilter}
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          )}
        </div>
      )}

      {enableMultiSort && (
        <p className="border-b border-border bg-surface px-4 py-2 text-2xs text-foreground-muted">
          Click a column header to sort, or Shift + click to sort by several columns at once.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-surface-secondary/40">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as { className?: string; sticky?: boolean } | undefined;
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const label = String(header.column.columnDef.header ?? '');
                  const sortedDirection = sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : 'not sorted';
                  const sortPosition = canSort && sorted ? header.column.getSortIndex() + 1 : 0;

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={canSort ? (sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                      className={cn(
                        'px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary',
                        meta?.className,
                        canSort && 'cursor-pointer select-none',
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={(event) => {
                            // Shift + click keeps the existing sort and appends this column,
                            // giving multi-column sorting; a plain click replaces it.
                            if (canSort) {
                              header.column.toggleSorting(sorted === 'asc', !(enableMultiSort && event.shiftKey));
                            }
                          }}
                          className={cn(
                            'inline-flex items-center gap-1.5 text-left font-medium transition-colors hover:text-foreground',
                            !canSort && 'cursor-default',
                          )}
                          aria-label={
                            canSort
                              ? `Sort by ${label}, currently ${sortedDirection}.${
                                  enableMultiSort ? ' Hold Shift and press Enter to sort by multiple columns.' : ''
                                }`
                              : undefined
                          }
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {canSort && (
                            <>
                              <span aria-hidden className="text-foreground-muted">
                                {header.column.getIsSorted() === 'asc' ? (
                                  <ArrowUp className="h-3.5 w-3.5" />
                                ) : header.column.getIsSorted() === 'desc' ? (
                                  <ArrowDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowDown className="h-3.5 w-3.5 opacity-50" />
                                )}
                              </span>
                              {sortPosition > 1 && (
                                <span
                                  aria-hidden
                                  className="rounded-sm bg-gold-soft px-1 text-2xs font-semibold tabular text-gold-strong"
                                >
                                  {sortPosition}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8">
                  {emptyState ?? (
                    <div className="flex min-h-24 items-center justify-center text-sm text-foreground-secondary">
                      No records found.
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const interactive = typeof onRowClick === 'function';

                return (
                  <tr
                    key={row.id}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    onClick={interactive ? () => onRowClick?.(row.original) : undefined}
                    onKeyDown={
                      interactive
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onRowClick?.(row.original);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      'transition-colors duration-fast hover:bg-surface-secondary/30',
                      interactive && 'cursor-pointer focus-visible:bg-surface-secondary focus-visible:outline-none',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-4 py-3 align-middle text-foreground',
                          (cell.column.columnDef.meta as { className?: string } | undefined)?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {canPaginate && (
        <div className="flex flex-col gap-3 border-t border-border bg-surface-secondary/20 px-4 py-3 text-xs text-foreground-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>{summary}</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              leftIcon={<ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
            >
              Prev
            </Button>
            <span className="tabular-nums">
              {table.getState().pagination.pageIndex + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              rightIcon={<ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

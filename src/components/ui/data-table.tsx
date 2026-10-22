'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export type DataTableColumn<TData, TValue = unknown> = ColumnDef<TData, TValue>;

export interface DataTableProps<TData, TValue = unknown> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  /** Stable row ids keep selection and sorting attached to the right row when `data` changes. */
  getRowId?: (row: TData, index: number) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Rows per page. Values below 1 are treated as 1. */
  pageSize?: number;
  /** When set, shows a rows-per-page selector with these choices. */
  pageSizeOptions?: number[];
  className?: string;
  /** Rendered in place of the rows when there are none (or no row matches the search). */
  emptyState?: React.ReactNode;
  /** Names the table: shown above it, and read by screen readers as its caption. */
  caption?: string;
  /** Makes rows clickable and keyboard-activatable (Enter or Space on a focused row). */
  onRowClick?: (row: TData) => void;
  /** Adds a leading checkbox column, with a select-all for the current page. */
  enableRowSelection?: boolean;
  /** Called with the selected rows whenever the selection changes (selection spans pages). */
  onSelectionChange?: (rows: TData[]) => void;
  initialSorting?: SortingState;
}

interface ColumnMeta {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 10;

/** Clicks and key presses that start inside these belong to the control, not to the row. */
const INTERACTIVE = 'a,button,input,select,textarea,label,[role="checkbox"]';

function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded-sm border-border accent-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function selectColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: 'select',
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { className: 'w-10' } satisfies ColumnMeta,
    header: ({ table }) => (
      <SelectionCheckbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        label="Select all rows on this page"
      />
    ),
    cell: ({ row }) => (
      <SelectionCheckbox
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        label={`Select row ${row.index + 1}`}
      />
    ),
  };
}

/**
 * A sortable, searchable, paginated table built on TanStack Table, for any row
 * type. Sort state is exposed to assistive technology with `aria-sort` on each
 * sortable header, the sort control is a real button, pagination announces the
 * visible range, and selection and row activation work from the keyboard.
 */
export function DataTable<TData, TValue = unknown>({
  data,
  columns,
  getRowId,
  searchable = false,
  searchPlaceholder = 'Search rows...',
  pageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions,
  className,
  emptyState,
  caption,
  onRowClick,
  enableRowSelection = false,
  onSelectionChange,
  initialSorting = [],
}: DataTableProps<TData, TValue>) {
  const searchId = useId();
  const initialPageSize = Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE);

  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const allColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    const base = columns as unknown as ColumnDef<TData, unknown>[];
    return enableRowSelection ? [selectColumn<TData>(), ...base] : base;
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: { sorting, globalFilter, pagination, rowSelection },
    enableRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue ?? '').trim().toLowerCase();
      if (!search) return true;
      return row
        .getAllCells()
        .filter((cell) => cell.column.getCanGlobalFilter())
        .some((cell) => {
          const value = cell.getValue();
          return (
            (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') &&
            String(value).toLowerCase().includes(search)
          );
        });
    },
  });

  // Report the selection without making an inline callback re-run the effect.
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  useEffect(() => {
    onSelectionChangeRef.current?.(table.getSelectedRowModel().flatRows.map((row) => row.original));
  }, [rowSelection, table]);

  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const filteredCount = table.getFilteredRowModel().rows.length;
  const firstRow = filteredCount === 0 ? 0 : pageIndex * currentPageSize + 1;
  const lastRow = Math.min(filteredCount, (pageIndex + 1) * currentPageSize);
  const selectedCount = Object.keys(rowSelection).length;
  const showPagination = pageCount > 1 || Boolean(pageSizeOptions?.length);
  const rowCount = table.getRowModel().rows.length;
  const columnCount = table.getVisibleLeafColumns().length;
  const interactive = typeof onRowClick === 'function';

  return (
    <div className={cn('overflow-hidden rounded-card border border-border bg-surface', className)}>
      {(searchable || caption) && (
        <div className="flex flex-col gap-3 border-b border-border bg-surface-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          {caption && (
            <p
              aria-hidden
              className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
            >
              {caption}
            </p>
          )}
          {searchable && (
            <div role="search" className="relative block w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted"
                aria-hidden
              />
              <input
                id={searchId}
                type="search"
                aria-label={caption ? `Search ${caption}` : 'Search table rows'}
                value={globalFilter}
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                  setPagination((current) => ({ ...current, pageIndex: 0 }));
                }}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-surface-secondary/40">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const content = header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext());

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        canSort
                          ? sorted === 'asc'
                            ? 'ascending'
                            : sorted === 'desc'
                              ? 'descending'
                              : 'none'
                          : undefined
                      }
                      className={cn(
                        'px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary',
                        meta?.className,
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 rounded-sm text-left font-medium uppercase tracking-[0.18em] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span>{content}</span>
                          <span aria-hidden className="text-foreground-muted">
                            {sorted === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                            )}
                          </span>
                        </button>
                      ) : (
                        content
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-border">
            {rowCount === 0 ? (
              <tr>
                <td colSpan={columnCount} className="p-8">
                  {emptyState ?? (
                    <div
                      role="status"
                      className="flex min-h-24 items-center justify-center text-sm text-foreground-secondary"
                    >
                      No records found.
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={interactive ? 0 : undefined}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  onClick={
                    interactive
                      ? (event) => {
                          if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
                          onRowClick?.(row.original);
                        }
                      : undefined
                  }
                  onKeyDown={
                    interactive
                      ? (event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onRowClick?.(row.original);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'transition-colors duration-fast hover:bg-surface-secondary/30',
                    row.getIsSelected() && 'bg-gold-soft/40',
                    interactive &&
                      'cursor-pointer focus-visible:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-3 align-middle text-foreground',
                        (cell.column.columnDef.meta as ColumnMeta | undefined)?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(showPagination || enableRowSelection) && (
        <nav
          aria-label="Table pagination"
          className="flex flex-col gap-3 border-t border-border bg-surface-secondary/20 px-4 py-3 text-xs text-foreground-secondary sm:flex-row sm:items-center sm:justify-between"
        >
          <p aria-live="polite">
            {filteredCount === 0
              ? '0 rows'
              : `${firstRow}-${lastRow} of ${filteredCount}`}
            {enableRowSelection && selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
          </p>

          {showPagination && (
            <div className="flex flex-wrap items-center gap-3">
              {pageSizeOptions && pageSizeOptions.length > 0 && (
                <label className="flex items-center gap-2">
                  <span>Rows per page</span>
                  <select
                    value={currentPageSize}
                    onChange={(event) => table.setPageSize(Number(event.target.value))}
                    className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {Array.from(new Set([...pageSizeOptions, currentPageSize]))
                      .sort((a, b) => a - b)
                      .map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label="Previous page"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  leftIcon={<ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
                >
                  Prev
                </Button>
                <span className="tabular-nums">
                  Page {pageIndex + 1} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label="Next page"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  rightIcon={<ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}

export default DataTable;

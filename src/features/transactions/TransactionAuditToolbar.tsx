'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, FileSpreadsheet, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface TransactionAuditToolbarProps {
  totalRecordsCount: number;
  filteredRecordsCount: number;
  onExportCSV?: () => void;

  // Pagination props (optional)
  page?: number;
  pageSize?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  // Loading / empty states (optional)
  isLoading?: boolean;
  isEmpty?: boolean;
}

export function TransactionAuditToolbar({
  totalRecordsCount,
  filteredRecordsCount,
  onExportCSV,
  page = 1,
  pageSize = 10,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  isEmpty = false,
}: TransactionAuditToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read URL query params
  const initialSearch = searchParams.get('q') || '';
  const initialStatus = searchParams.get('status') || 'all';
  const initialAsset = searchParams.get('asset') || 'all';

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [assetFilter, setAssetFilter] = useState(initialAsset);

  // Debounced URL query param update
  useEffect(() {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchTerm.trim()) {
        params.set('q', searchTerm.trim());
      } else {
        params.delete('q');
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      } else {
        params.delete('status');
      }

      if (assetFilter !== 'all') {
        params.set('asset', assetFilter);
      } else {
        params.delete('asset');
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, statusFilter, assetFilter, pathname, router, searchParams]);

  // Clear filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setAssetFilter('all');
    router.replace(pathname, { scroll: false });
  };

  const hasActiveFilters = useMemo(
    () => Boolean(searchTerm || statusFilter !== 'all' || assetFilter !== 'all'),
    [searchTerm, statusFilter, assetFilter]
  );

  const displayRecordRange = useMemo(() => {
    if (filteredRecordsCount === 0) { return { start: 0, end: 0 }; }
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, filteredRecordsCount);
    return { start, end };
  }, [page, pageSize, filteredRecordsCount]);

  const paginationEnabled = Boolean(onPageChange) && Boolean(onPageSizeChange);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search by asset code, public key, tx hash, or recipient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-button border border-border bg-surface pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-foreground-muted hover:text-foreground"
               aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground font-medium focus:border-gold focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value)}
            className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground font-medium focus:border-gold focus:outline-none"
          >
            <option value="all">All Assets</option>
            <option value="USDC">USDC</option>
            <option value="XLM">XLM</option>
            <option value="ASTRO">ASTRO</option>
            <option value="EURC">EURC</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-2xs font-semibold text-gold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {onExportCSV && (
          <button
            type="button"
            onClick={onExportCSV}
            className="flex items-center gap-1.5 rounded-button border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground-secondary hover:border-gold hover:text-foreground transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-2xs text-foreground-muted">
        <span>
          {isLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="animate-spin rounded-full h-3 w-3 border-2 border-gold border-t-transparent" />
              Loading transactions...
            </span>
          ) : isEmpty ? 'No transactions found' : (
            `Showing ${displayRecordRange.start}-${displayRecordRange.end} of ${filteredRecordsCount} transactions`
          )}
        </span>
        {hasActiveFilters && <span className="font-mono text-gold font-medium">URL state synchronized</span>}
      </div>

      {paginationEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <span className="text-2xs text-foreground-muted">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-button border border-border bg-surface px-2 py-1 text-xs text-foreground font-medium focus:border-gold focus:outline-none"
            >
              {[10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-button border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="px-2 text-2xs text-foreground-muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-button border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

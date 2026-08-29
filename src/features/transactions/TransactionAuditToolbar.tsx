'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, FileSpreadsheet, X } from 'lucide-react';

interface TransactionAuditToolbarProps {
  totalRecordsCount: number;
  filteredRecordsCount: number;
  onExportCSV?: () => void;
}

export function TransactionAuditToolbar({
  totalRecordsCount,
  filteredRecordsCount,
  onExportCSV,
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
  useEffect(() => {
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

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'all' || assetFilter !== 'all');

  return (
    <div className="space-y-4">
      {/* Toolbar Container */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Debounced Search Input */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search by agent name, tx hash, or recipient address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-button border border-border bg-surface pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-foreground-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-foreground font-medium focus:border-gold focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending Review</option>
          </select>

          {/* Asset Filter */}
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

        {/* CSV Export Button */}
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

      {/* Record Counter */}
      <div className="flex items-center justify-between text-2xs text-foreground-muted">
        <span>Showing {filteredRecordsCount} of {totalRecordsCount} transactions</span>
        {hasActiveFilters && <span className="font-mono text-gold font-medium">URL state synchronized</span>}
      </div>
    </div>
  );
}

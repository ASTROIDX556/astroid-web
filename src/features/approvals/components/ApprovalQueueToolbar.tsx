'use client';

import { ArrowDown, ArrowUp, Search, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { proposalStatus } from '@/lib/status';
import type { ProposalStatus, RiskLevel } from '@/types/domain';

import {
  APPROVAL_QUEUE_SORT_IDS,
  APPROVAL_QUEUE_SORT_LABELS,
  type ApprovalQueueFilters,
  type ApprovalQueueSort,
  type ApprovalQueueSortId,
} from '../approvalQueueFilters';

const SELECT_CLASS =
  'h-9 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const FILTER_LABEL_CLASS = 'text-2xs text-foreground-secondary';

const tierLabel = (tier: RiskLevel): string => tier.charAt(0).toUpperCase() + tier.slice(1);

interface ApprovalQueueToolbarProps {
  filters: ApprovalQueueFilters;
  onFilterChange: <TKey extends keyof ApprovalQueueFilters>(
    key: TKey,
    value: ApprovalQueueFilters[TKey],
  ) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  statusOptions: ProposalStatus[];
  agentOptions: string[];
  riskTierOptions: RiskLevel[];
  sort: ApprovalQueueSort;
  onSortChange: (id: ApprovalQueueSortId) => void;
  visibleCount: number;
  totalCount: number;
}

/**
 * Filter + sort controls for the approvals queue (#232).
 *
 * Every interactive control carries an explicit accessible name, the sort
 * buttons expose state via `aria-pressed`, and the result count is announced
 * through an `aria-live` region so filtering is perceivable without sight.
 */
export function ApprovalQueueToolbar({
  filters,
  onFilterChange,
  onClearFilters,
  activeFilterCount,
  statusOptions,
  agentOptions,
  riskTierOptions,
  sort,
  onSortChange,
  visibleCount,
  totalCount,
}: ApprovalQueueToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative flex min-w-56 flex-1 flex-col gap-1">
          <span className={FILTER_LABEL_CLASS}>Search proposals</span>
          <Search
            className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-foreground-muted"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search proposals by agent, proposer, asset, or amount"
            value={filters.query}
            onChange={(event) => onFilterChange('query', event.target.value)}
            placeholder="Agent, proposer, asset, amount…"
            className="h-9 rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className={FILTER_LABEL_CLASS}>Status</span>
          <select
            aria-label="Filter proposals by status"
            value={filters.status}
            onChange={(event) =>
              onFilterChange('status', event.target.value as ApprovalQueueFilters['status'])
            }
            className={SELECT_CLASS}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {proposalStatus(status).label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className={FILTER_LABEL_CLASS}>Agent</span>
          <select
            aria-label="Filter proposals by agent"
            value={filters.agent}
            onChange={(event) => onFilterChange('agent', event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All agents</option>
            {agentOptions.map((agent) => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className={FILTER_LABEL_CLASS}>Risk</span>
          <select
            aria-label="Filter proposals by risk tier"
            value={filters.riskTier}
            onChange={(event) =>
              onFilterChange('riskTier', event.target.value as ApprovalQueueFilters['riskTier'])
            }
            className={SELECT_CLASS}
          >
            <option value="all">All risk tiers</option>
            {riskTierOptions.map((tier) => (
              <option key={tier} value={tier}>
                {tierLabel(tier)}
              </option>
            ))}
          </select>
        </label>

        <div
          role="group"
          aria-label="Sort proposals"
          className="flex items-center gap-1 rounded-md border border-border bg-surface p-1"
        >
          {APPROVAL_QUEUE_SORT_IDS.map((id) => {
            const active = sort.id === id;
            const label = APPROVAL_QUEUE_SORT_LABELS[id];
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                aria-label={
                  active
                    ? `Sort proposals by ${label}, currently ${sort.desc ? 'descending' : 'ascending'}. Activate to reverse the order.`
                    : `Sort proposals by ${label}`
                }
                onClick={() => onSortChange(id)}
                className={`inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? 'bg-gold-soft text-gold-strong'
                    : 'text-foreground-secondary hover:text-foreground'
                }`}
              >
                {label}
                {active &&
                  (sort.desc ? (
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  ))}
              </button>
            );
          })}
        </div>

        {activeFilterCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            leftIcon={<XCircle className="h-3.5 w-3.5" aria-hidden />}
          >
            Clear filters
            <span className="sr-only">({activeFilterCount} active)</span>
          </Button>
        )}
      </div>

      <p aria-live="polite" className="text-2xs text-foreground-muted">
        {visibleCount === totalCount
          ? `${totalCount} proposals`
          : `${visibleCount} of ${totalCount} proposals match the filters`}
      </p>
    </div>
  );
}

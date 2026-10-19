'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

import { EmptyState } from '@/components/ui/empty-state';
import { BellIllustration } from '@/components/illustrations';
import { SectionLabel } from '@/components/dashboard/stat-card';
import type { Proposal } from '@/types/domain';

import {
  compareApprovalQueueRows,
  countActiveApprovalQueueFilters,
  collectApprovalAgentOptions,
  collectApprovalRiskTierOptions,
  collectApprovalStatusOptions,
  DEFAULT_APPROVAL_QUEUE_FILTERS,
  filterApprovalQueue,
  parseApprovalQueueQuery,
  writeApprovalQueueQuery,
  type ApprovalQueueFilters,
  type ApprovalQueueQueryState,
  type ApprovalQueueSortId,
} from './approvalQueueFilters';
import { ApprovalQueueToolbar } from './components/ApprovalQueueToolbar';
import { ProposalCard } from './components/ProposalQueueCard';

/**
 * Sort columns are declared as a TanStack Table instance and applied through
 * `getSortedRowModel`, but rendered as cards — the queue is a card list, so
 * the table is the sorting/state engine, not the presentation. Comparators
 * come from `approvalQueueFilters` so filter and sort share one vocabulary.
 */
const COLUMNS: ColumnDef<Proposal>[] = [
  {
    id: 'amount',
    accessorFn: (proposal) => proposal.amount,
    header: 'Amount',
    sortingFn: (rowA, rowB) => compareApprovalQueueRows(rowA.original, rowB.original, 'amount'),
  },
  {
    id: 'date',
    accessorFn: (proposal) => proposal.createdAt,
    header: 'Date',
    sortingFn: (rowA, rowB) => compareApprovalQueueRows(rowA.original, rowB.original, 'date'),
  },
  {
    id: 'risk',
    accessorFn: (proposal) => proposal.riskScore,
    header: 'Risk level',
    sortingFn: (rowA, rowB) => compareApprovalQueueRows(rowA.original, rowB.original, 'risk'),
  },
];

/**
 * Filter and sort state lives in URL search params rather than local state
 * (#246 AC3), so a review in progress survives navigation between views,
 * back/forward, and a shared link. The same `approvalQueueFilters` vocabulary
 * drives both the URL round-trip and the in-memory predicates, and the
 * router.replace sync mirrors `TransactionAuditToolbar`.
 */
export function ApprovalQueue({ proposals }: { proposals: Proposal[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { filters, sort } = useMemo(
    () => parseApprovalQueueQuery(searchParams),
    [searchParams],
  );

  const applyQuery = (next: ApprovalQueueQueryState) => {
    const params = writeApprovalQueueQuery(next, searchParams);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const filtered = useMemo(
    () => filterApprovalQueue(proposals, filters),
    [proposals, filters],
  );

  const statusOptions = useMemo(() => collectApprovalStatusOptions(proposals), [proposals]);
  const agentOptions = useMemo(() => collectApprovalAgentOptions(proposals), [proposals]);
  const riskTierOptions = useMemo(() => collectApprovalRiskTierOptions(proposals), [proposals]);
  const activeFilterCount = countActiveApprovalQueueFilters(filters);
  const pending = useMemo(
    () => proposals.filter((proposal) => proposal.status === 'pending').length,
    [proposals],
  );

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    getRowId: (proposal) => proposal.id,
    state: {
      sorting: [{ id: sort.id, desc: sort.desc }] satisfies SortingState,
    },
    onSortingChange: (update) => {
      const next = typeof update === 'function' ? update([]) : update;
      const [first] = next;
      if (first) {
        applyQuery({ filters, sort: { id: first.id as ApprovalQueueSortId, desc: !!first.desc } });
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedProposals = table.getSortedRowModel().rows.map((row) => row.original);

  const setFilter = <TKey extends keyof ApprovalQueueFilters>(
    key: TKey,
    value: ApprovalQueueFilters[TKey],
  ) => applyQuery({ filters: { ...filters, [key]: value }, sort });

  const toggleSort = (id: ApprovalQueueSortId) =>
    applyQuery({
      filters,
      sort: sort.id === id ? { id, desc: !sort.desc } : { id, desc: true },
    });

  return (
    <div className="space-y-6">
      <SectionLabel>
        {pending} of {proposals.length} awaiting decision
      </SectionLabel>

      <ApprovalQueueToolbar
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={() => applyQuery({ filters: DEFAULT_APPROVAL_QUEUE_FILTERS, sort })}
        activeFilterCount={activeFilterCount}
        statusOptions={statusOptions}
        agentOptions={agentOptions}
        riskTierOptions={riskTierOptions}
        sort={sort}
        onSortChange={toggleSort}
        visibleCount={filtered.length}
        totalCount={proposals.length}
      />

      {sortedProposals.length === 0 ? (
        <EmptyState
          illustration={<BellIllustration />}
          title="No proposals match these filters"
          description="Try widening the status, agent, or risk tier filters to see more of the queue."
          action={
            <button
              type="button"
              onClick={() => applyQuery({ filters: DEFAULT_APPROVAL_QUEUE_FILTERS, sort })}
              className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear all filters
            </button>
          }
        />
      ) : (
        <ul className="space-y-4" aria-label="Approval queue">
          {sortedProposals.map((proposal) => (
            <li key={proposal.id}>
              <ProposalCard proposal={proposal} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

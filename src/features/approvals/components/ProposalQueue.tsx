import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';

export interface Proposal {
  id: string;
  agentSource: string;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submissionDate: string;
  amount: number;
  requiredThreshold: number;
}

interface ProposalQueueProps {
  proposals: Proposal[];
}

export const ProposalQueue: React.FC<ProposalQueueProps> = ({ proposals }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns = useMemo<ColumnDef<Proposal>[]>(() => [
    {
      accessorKey: 'id',
      header: 'Proposal ID',
    },
    {
      accessorKey: 'agentSource',
      header: 'Agent Source',
    },
    {
      accessorKey: 'riskTier',
      header: 'Risk Tier',
    },
    {
      accessorKey: 'status',
      header: 'Status',
    },
    {
      accessorKey: 'submissionDate',
      header: 'Submission Date',
      cell: info => new Date(info.getValue() as string).toLocaleString(),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: info => `$${(info.getValue() as number).toLocaleString()}`,
    },
    {
      accessorKey: 'requiredThreshold',
      header: 'Required Threshold',
      cell: info => `$${(info.getValue() as number).toLocaleString()}`,
    },
  ], []);

  const table = useReactTable({
    data: proposals,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label htmlFor="status-filter" className="block mb-1 text-xs font-medium text-foreground-secondary">Status</label>
            <select
              id="status-filter"
              value={(table.getColumn('status')?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn('status')?.setFilterValue(e.target.value || undefined)}
              className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label htmlFor="risk-tier-filter" className="block mb-1 text-xs font-medium text-foreground-secondary">Risk Tier</label>
            <select
              id="risk-tier-filter"
              value={(table.getColumn('riskTier')?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn('riskTier')?.setFilterValue(e.target.value || undefined)}
              className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="">All Risk Tiers</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label htmlFor="agent-filter" className="block mb-1 text-xs font-medium text-foreground-secondary">Agent Source</label>
            <input
              id="agent-filter"
              type="text"
              placeholder="Filter agent..."
              value={(table.getColumn('agentSource')?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn('agentSource')?.setFilterValue(e.target.value || undefined)}
              className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-soft-1">
        <table className="min-w-full divide-y divide-border">
          <caption className="sr-only">Proposals by ID, agent, risk, status and amount</caption>
          <thead className="bg-surface-secondary">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const sorted = header.column.getIsSorted();
                  const ariaSort =
                    sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none';
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={ariaSort}
                      className="px-6 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-foreground-muted select-none"
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex w-full items-center space-x-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        <span aria-hidden="true">
                          {{
                            asc: ' ▲',
                            desc: ' ▼',
                          }[sorted as string] ?? null}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-4 text-center text-sm text-foreground-muted">
                  No proposals found matching the filter criteria.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-surface-secondary">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-foreground-secondary">
          Page <span className="font-medium">{table.getState().pagination.pageIndex + 1}</span> of <span className="font-medium">{table.getPageCount()}</span>
        </div>
        <div className="space-x-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-button border border-border bg-surface px-3 py-1 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-button border border-border bg-surface px-3 py-1 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

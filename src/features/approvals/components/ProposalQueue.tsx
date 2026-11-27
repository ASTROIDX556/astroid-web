import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  RowSelectionState,
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
  onBatchApprove?: (selectedIds: string[]) => void;
  onBatchReject?: (selectedIds: string[]) => void;
}

export const ProposalQueue: React.FC<ProposalQueueProps> = ({ proposals, onBatchApprove, onBatchReject }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmationModal, setConfirmationModal] = useState<{ isOpen: boolean; action: 'APPROVE' | 'REJECT' | null }>({
    isOpen: false,
    action: null,
  });

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const columns = useMemo<ColumnDef<Proposal>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          ref={headerCheckboxRef}
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          aria-label="Select all proposals"
          className="rounded border-border text-gold focus:ring-ring"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          aria-label="Select proposal row"
          className="rounded border-border text-gold focus:ring-ring"
        />
      ),
    },
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
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = table.getIsSomePageRowsSelected();
    }
  }, [table, rowSelection]);

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  const handleExecuteBatchAction = () => {
    const selectedIds = selectedRows.map(row => row.original.id);
    if (confirmationModal.action === 'APPROVE') {
      onBatchApprove?.(selectedIds);
    } else if (confirmationModal.action === 'REJECT') {
      onBatchReject?.(selectedIds);
    }
    setConfirmationModal({ isOpen: false, action: null });
    setRowSelection({});
  };

  return (
    <div className="p-6 space-y-4 relative pb-24">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label htmlFor="status-filter" className="block text-xs font-medium text-foreground-secondary mb-1">Status</label>
            <select
              id="status-filter"
              value={(table.getColumn('status')?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn('status')?.setFilterValue(e.target.value || undefined)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label htmlFor="risk-tier-filter" className="block text-xs font-medium text-foreground-secondary mb-1">Risk Tier</label>
            <select
              id="risk-tier-filter"
              value={(table.getColumn('riskTier')?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn('riskTier')?.setFilterValue(e.target.value || undefined)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <option value="">All Risk Tiers</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label htmlFor="agent-filter" className="block text-xs font-medium text-foreground-secondary mb-1">Agent Source</label>
            <input
              id="agent-filter"
              type="text"
              placeholder="Filter agent..."
              value={(table.getColumn('agentSource')?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn('agentSource')?.setFilterValue(e.target.value || undefined)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border shadow">
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
                      className="px-6 py-3 text-left text-xs font-medium text-foreground-secondary uppercase tracking-wider select-none"
                    >
                      <button
                        type="button"
                        onClick={header.column.id !== 'select' ? header.column.getToggleSortingHandler() : undefined}
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
          <tbody className="bg-surface divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-4 text-center text-sm text-foreground-muted">
                  No proposals found matching the filter criteria.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className={`hover:bg-surface-secondary ${row.getIsSelected() ? 'bg-gold-soft/50' : ''}`}>
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
            className="rounded border border-border bg-surface px-3 py-1 text-sm font-medium text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded border border-border bg-surface px-3 py-1 text-sm font-medium text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Next
          </button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-surface text-foreground px-6 py-3 rounded-xl shadow-2xl flex items-center space-x-6 border border-border animate-in fade-in slide-in-from-bottom-4">
          <div className="text-sm font-medium">
            <span className="font-bold text-gold mr-1.5">{selectedCount}</span>
            proposal{selectedCount === 1 ? '' : 's'} selected
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setConfirmationModal({ isOpen: true, action: 'APPROVE' })}
              className="bg-success hover:brightness-105 text-foreground-primary px-4 py-1.5 rounded-lg text-sm font-medium shadow transition-colors flex items-center space-x-1"
            >
              <span>Batch Approve</span>
            </button>
            <button
              onClick={() => setConfirmationModal({ isOpen: true, action: 'REJECT' })}
              className="bg-danger hover:brightness-105 text-foreground-primary px-4 py-1.5 rounded-lg text-sm font-medium shadow transition-colors flex items-center space-x-1"
            >
              <span>Batch Reject</span>
            </button>
            <button
              onClick={() => setRowSelection({})}
              className="text-foreground-muted hover:text-foreground text-sm font-medium px-2 py-1 transition-colors"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {confirmationModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm">
          <div className="bg-surface rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-border space-y-4">
            <h3 className="text-lg font-bold text-foreground">
              Confirm Batch {confirmationModal.action === 'APPROVE' ? 'Approval' : 'Rejection'}
            </h3>
            <p className="text-sm text-foreground-secondary">
              Are you sure you want to {confirmationModal.action === 'APPROVE' ? 'approve' : 'reject'} <span className="font-semibold text-foreground">{selectedCount}</span> selected proposal{selectedCount === 1 ? '' : 's'}? High-value operations require confirmation before execution.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmationModal({ isOpen: false, action: null })}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground bg-surface hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchAction}
                className={`px-4 py-2 rounded-lg text-foreground-primary text-sm font-medium shadow transition-colors ${
                  confirmationModal.action === 'APPROVE'
                    ? 'bg-success hover:brightness-105'
                    : 'bg-danger hover:brightness-105'
                }`}
              >
                Confirm {confirmationModal.action === 'APPROVE' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

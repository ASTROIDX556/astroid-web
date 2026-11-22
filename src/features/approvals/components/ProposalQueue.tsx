import React, { useState, useMemo, useRef, useEffect } from 'react';
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
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          aria-label="Select proposal row"
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
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
            <label htmlFor="status-filter" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              id="status-filter"
              value={(table.getColumn('status')?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn('status')?.setFilterValue(e.target.value || undefined)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label htmlFor="risk-tier-filter" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Risk Tier</label>
            <select
              id="risk-tier-filter"
              value={(table.getColumn('riskTier')?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn('riskTier')?.setFilterValue(e.target.value || undefined)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            >
              <option value="">All Risk Tiers</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label htmlFor="agent-filter" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Agent Source</label>
            <input
              id="agent-filter"
              type="text"
              placeholder="Filter agent..."
              value={(table.getColumn('agentSource')?.getFilterValue() as string) ?? ''}
              onChange={e => table.getColumn('agentSource')?.setFilterValue(e.target.value || undefined)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <caption className="sr-only">Proposals by ID, agent, risk, status and amount</caption>
          <thead className="bg-gray-50 dark:bg-gray-900">
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none"
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
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No proposals found matching the filter criteria.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${row.getIsSelected() ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''}`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
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
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Page <span className="font-medium">{table.getState().pagination.pageIndex + 1}</span> of <span className="font-medium">{table.getPageCount()}</span>
        </div>
        <div className="space-x-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
          >
            Next
          </button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900 dark:bg-gray-800 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center space-x-6 border border-gray-700 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-sm font-medium">
            <span className="font-bold text-indigo-400 mr-1.5">{selectedCount}</span>
            proposal{selectedCount === 1 ? '' : 's'} selected
          </div>
          <div className="h-5 w-px bg-gray-700" />
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setConfirmationModal({ isOpen: true, action: 'APPROVE' })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow transition-colors flex items-center space-x-1"
            >
              <span>Batch Approve</span>
            </button>
            <button
              onClick={() => setConfirmationModal({ isOpen: true, action: 'REJECT' })}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow transition-colors flex items-center space-x-1"
            >
              <span>Batch Reject</span>
            </button>
            <button
              onClick={() => setRowSelection({})}
              className="text-gray-400 hover:text-gray-200 text-sm font-medium px-2 py-1 transition-colors"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {confirmationModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Confirm Batch {confirmationModal.action === 'APPROVE' ? 'Approval' : 'Rejection'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to {confirmationModal.action === 'APPROVE' ? 'approve' : 'reject'} <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedCount}</span> selected proposal{selectedCount === 1 ? '' : 's'}? High-value operations require confirmation before execution.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmationModal({ isOpen: false, action: null })}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchAction}
                className={`px-4 py-2 rounded-lg text-white text-sm font-medium shadow transition-colors ${
                  confirmationModal.action === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
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

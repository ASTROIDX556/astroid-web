import { useEffect, useMemo, useState } from 'react';

export type TransactionStatus = 'Pending' | 'Approved' | 'Rejected';

function useDebouncedValue<T>(value: T, delay = 150): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export function useTransactions<T extends { status?: string; department?: string; assetCode?: string; destination?: string; agent?: string }>(
  transactions: T[],
  options: { pageSize?: number; page?: number } = {}
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [pageSize, setPageSizeState] = useState(options.pageSize ?? 10);
  const [currentPage, setCurrentPage] = useState(options.page ?? 1);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 150).trim().toLowerCase();

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const searchable = `${tx.assetCode ?? ''} ${tx.destination ?? ''} ${tx.agent ?? ''}'.toLowerCase();
      if (debouncedSearchQuery && !searchable.includes(debouncedSearchQuery)) return false;
      if (statusFilter !== 'All' && tx.status !== statusFilter) return false;
      if (departmentFilter !== 'All' && tx.department !== departmentFilter) return false;
      return true;
    });
  }, [transactions, debouncedSearchQuery, statusFilter, departmentFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, statusFilter, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const pagedTransactions = filteredTransactions.slice(startIndex, startIndex + pageSize);

  const goToPage = (page: number) => setCurrentPage(Math.min(Math.max(1, page), totalPages));
  const nextPage = () => goToPage(safeCurrentPage + 1);
  const previousPage = () => goToPage(safeCurrentPage - 1);
  const setPageSize = (size: number) => {
    setPageSizeState(Math.max(1, size));
    setCurrentPage(1);
  };

  const departments = useMemo(() => Array.from(new Set(transactions.map((tx) => tx.department).filter(Boolean))), [transactions]);

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    currentPage: safeCurrentPage,
    pageSize,
    totalPages,
    filteredTransactions,
    pagedTransactions,
    canPrevious: safeCurrentPage > 1,
    canNext: safeCurrentPage < totalPages,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    departments,
    isLoading: false,
  };
}

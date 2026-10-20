'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { EmptyState } from '@/components/ui/empty-state';
import { ChartIllustration } from '@/components/illustrations';
import { useTransactions } from '@/hooks/use-queries';
import { PageTransition } from '@/components/ui/motion';
import { XdrSignatureStatus } from '@/features/transactions/XdrSignatureStatus';
import { FeeOptimizationPanel } from '@/features/transactions/FeeOptimizationPanel';
import { TransactionAuditToolbar } from '@/features/transactions/TransactionAuditToolbar';
import { TransactionHistory } from '@/features/transactions/TransactionHistory';

export default function TransactionsPage() {
  const transactions = useTransactions();
  const [filters, setFilters] = useState({ search: '', status: 'all', asset: 'all' });

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Operate"
        title="Transactions"
        description="Every value movement your agents have proposed, approved and settled on Stellar."
      />

      <XdrSignatureStatus />

      <QueryBoundary
        query={transactions}
        loading={<div className="skeleton h-96 w-full rounded-card" />}
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            illustration={<ChartIllustration />}
            title="No transactions yet"
            description="Once your agents start moving value, their on-chain activity lands here."
          />
        }
      >
        {(data) => {
          const filteredData = data.filter((transaction) => {
            const matchesSearch = !filters.search || Object.values(transaction)
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(filters.search.toLowerCase()));
            const matchesStatus = filters.status === 'all' || (filters.status === 'success'
              ? ['completed', 'confirmed', 'approved'].includes(transaction.status)
              : transaction.status === filters.status);
            const matchesAsset = filters.asset === 'all' || transaction.asset === filters.asset;
            return matchesSearch && matchesStatus && matchesAsset;
          });

          return (
            <div className="space-y-8">
              <FeeOptimizationPanel />
              <div className="space-y-4 border-t border-border pt-4">
                <TransactionAuditToolbar
                  totalRecordsCount={data.length}
                  filteredRecordsCount={filteredData.length}
                  onFiltersChange={setFilters}
                />
                <TransactionHistory transactions={filteredData} />
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

'use client';

import React from 'react';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { EmptyState } from '@/components/ui/empty-state';
import { ChartIllustration } from '@/components/illustrations';
import { useTransactions } from '@/hooks/use-queries';
import { PageTransition } from '@/components/ui/motion';
import XdrSignatureStatus from '@/features/transactions/XdrSignatureStatus';
import { FeeOptimizationPanel } from '@/features/transactions/FeeOptimizationPanel';
import { TransactionAuditToolbar } from '@/features/transactions/TransactionAuditToolbar';
import { TransactionHistory } from '@/features/transactions/TransactionHistory';

export default function TransactionsPage() {
  const { data: transactions, isLoading } = useTransactions();

  return (
    <PageTransition>
      <div className="space-y-6">
        <TransactionAuditToolbar />
        <FeeOptimizationPanel />
        <XdrSignatureStatus />
        <QueryBoundary
          loading={isLoading}
          empty={!transactions || transactions.length === 0}
          emptyComponent={
            <EmptyState
              illustration={<ChartIllustration />}
              title="No Transactions"
              description="No transaction history found."
            />
          }
        >
          <TransactionHistory />
        </QueryBoundary>
      </div>
    </PageTransition>
  );
}
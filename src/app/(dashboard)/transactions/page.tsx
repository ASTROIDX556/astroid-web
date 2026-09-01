'use client';

import React from 'react';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { useTransactions } from '@/hooks/use-queries';
import { PageTransition } from '@/components/ui/motion';
import XdrSignatureStatus from '@/features/transactions/XdrSignatureStatus';
import { FeeOptimizationPanel } from '@/features/transactions/FeeOptimizationPanel';
import { TransactionAuditToolbar } from '@/features/transactions/TransactionAuditToolbar';
import { TransactionHistory } from '@/features/transactions/TransactionHistory';


export default function TransactionsPage() {
  const query = useTransactions();
  const txList = Array.isArray(query.data) ? query.data : [];
  const txCount = txList.length;

  const handleExportCSV = () => {
    // Export placeholder
  };

  return (
    <PageTransition
      children={
        <div className="space-y-6">
          <TransactionAuditToolbar
            totalRecordsCount={txCount}
            filteredRecordsCount={txCount}
            onExportCSV={handleExportCSV}
          />
          <FeeOptimizationPanel />
          <XdrSignatureStatus />
          <QueryBoundary
            query={query}
            render={(transactions) => (
              <TransactionHistory
                transactions={Array.isArray(transactions) ? transactions : txList}
              />
            )}
          />
        </div>
      }
    />
  );
}
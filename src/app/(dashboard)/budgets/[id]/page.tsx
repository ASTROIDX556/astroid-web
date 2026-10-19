'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue, SectionLabel } from '@/components/dashboard/stat-card';
import { ProgressBar } from '@/components/dashboard/risk-badge';
import { DataTable, type Column } from '@/components/dashboard/data-table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ChartIllustration } from '@/components/illustrations';
import { useBudget, useBudgets, useTransactions } from '@/hooks/use-queries';
import { transactionStatus } from '@/lib/status';
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  formatRelativeTime,
} from '@/lib/format';
import type { Transaction } from '@/types/domain';
import { PageTransition, AnimatedNumber } from '@/components/ui/motion';
import { ExpenseBreakdownChart } from '@/features/budgets/ExpenseBreakdownChart';
import { buildExpenseSeries } from '@/features/budgets/utils/expenseBreakdown';

const spendColumns: Column<Transaction>[] = [
  {
    header: 'Date',
    cell: (t) => (
      <span className="text-2xs text-foreground-muted">{formatRelativeTime(t.createdAt)}</span>
    ),
  },
  {
    header: 'Counterparty',
    cell: (t) => <span className="font-medium text-foreground">{t.counterparty}</span>,
  },
  {
    header: 'Purpose',
    hideOnMobile: true,
    cell: (t) => (
      <span className="max-w-prose truncate text-foreground-secondary">{t.purpose}</span>
    ),
  },
  {
    header: 'Status',
    cell: (t) => {
      const meta = transactionStatus(t.status);
      return (
        <Badge variant={meta.variant} size="sm" dot>
          {meta.label}
        </Badge>
      );
    },
  },
  {
    header: 'Amount',
    align: 'right',
    cell: (t) => (
      <span className="tabular font-medium">{formatCurrency(t.amount, t.asset)}</span>
    ),
  },
];

export default function BudgetDetailPage({ params }: { params: { id: string } }) {
  const budget = useBudget(params.id);
  const allBudgets = useBudgets();
  const allTransactions = useTransactions();

  return (
    <PageTransition className="space-y-8">
      <Link
        href="/budgets"
        className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to budgets
      </Link>

      <QueryBoundary
        query={budget}
        loading={
          <div className="space-y-6">
            <div className="skeleton h-24 w-full rounded-card" />
            <div className="skeleton h-64 w-full rounded-card" />
          </div>
        }
      >
        {(data) => {
          const utilization = data.limit > 0 ? (data.spent / data.limit) * 100 : 0;
          const children = (allBudgets.data ?? []).filter(
            (b) => b.parentBudgetId === data.id,
          );
          const parent = (allBudgets.data ?? []).find((b) => b.id === data.parentBudgetId);

          // Budget-scoped ledger: outbound agent spend against this envelope.
          const spend = (allTransactions.data ?? []).filter(
            (t) => t.direction === 'outbound' && t.asset === data.currency,
          );
          const inbound = (allTransactions.data ?? []).filter(
            (t) => t.direction === 'inbound' && t.asset === data.currency,
          );
          const totalIn = inbound.reduce((s, t) => s + t.amount, 0);
          const totalOut = spend.reduce((s, t) => s + t.amount, 0);

          return (
            <div className="space-y-8">
              <PageHeader
                eyebrow={data.scope}
                title={data.name}
                description={`${data.period} envelope · resets ${formatRelativeTime(data.resetsAt)}`}
                actions={
                  <Badge
                    variant={
                      utilization >= 90 ? 'danger' : utilization >= 75 ? 'warning' : 'success'
                    }
                    dot
                  >
                    {formatPercent(utilization)} used
                  </Badge>
                }
              />

              {/* Utilization hero */}
              <Card className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-gold-sheen" aria-hidden />
                <div className="relative p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-2xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
                        <AnimatedNumber value={data.limit} formatter={(v) => formatCurrency(v, data.currency, { compact: true })} /> limit
                      </p>
                      <p className="mt-2 font-display text-4xl font-semibold leading-none tracking-tight tabular">
                        <AnimatedNumber value={data.spent} formatter={(v) => formatCurrency(v, data.currency, { compact: true })} />
                      </p>
                      <p className="mt-2 text-2xs text-foreground-secondary">
                        <AnimatedNumber value={data.remaining} formatter={(v) => formatCurrency(v, data.currency)} /> remaining of{' '}
                        <AnimatedNumber value={data.limit} formatter={(v) => formatCurrency(v, data.currency)} /> this {data.period}
                      </p>
                    </div>
                    <span className="tabular text-3xl font-semibold text-foreground">
                      <AnimatedNumber value={utilization} formatter={(v) => formatPercent(v)} />
                    </span>
                  </div>
                  <ProgressBar value={utilization} label="Budget utilization" className="mt-4" tone={utilization >= 90 ? 'danger' : utilization >= 75 ? 'warning' : 'gold'} />
                </div>
              </Card>

              {/* Historical expense breakdown (#247): this budget's outbound spend bucketed into a Recharts time series. */}
              <ExpenseBreakdownChart
                series={buildExpenseSeries(
                  spend.map((t) => ({
                    date: t.createdAt,
                    amount: t.amount,
                    counterparty: t.counterparty,
                    description: t.purpose,
                  })),
                )}
                asset={data.currency}
                subjectName={data.name}
                title="Expense breakdown over time"
                description="Historical spend drawn against this envelope, bucketed by day or week."
              />

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Spend ledger */}
                <div className="space-y-4 lg:col-span-2">
                  <SectionLabel>Spend under this budget</SectionLabel>
                  {spend.length === 0 ? (
                    <EmptyState
                      compact
                      illustration={<ChartIllustration />}
                      title="No spend yet"
                      description="Agent outflows drawn against this envelope will appear here."
                    />
                  ) : (
                    <DataTable<Transaction>
                      columns={spendColumns}
                      rows={spend}
                      rowKey={(t) => t.id}
                      rowHref={(t) => `/transactions/${t.id}`}
                      compact
                    />
                  )}
                </div>

                {/* Rail */}
                <div className="space-y-4">
                  <SectionLabel>Overview</SectionLabel>
                  <Card className="p-5">
                    <dl className="grid gap-4">
                      <KeyValue label="Period">
                        <span className="capitalize">{data.period}</span>
                      </KeyValue>
                      <KeyValue label="Scope">
                        <span className="capitalize">{data.scope}</span>
                      </KeyValue>
                      <KeyValue label="Resets">{formatDateTime(data.resetsAt)}</KeyValue>
                      <KeyValue label="Created">{formatDateTime(data.createdAt)}</KeyValue>
                      {parent && (
                        <KeyValue label="Parent budget">
                          <Link
                            href={`/budgets/${parent.id}`}
                            className="inline-flex items-center gap-1 text-gold-strong hover:underline"
                          >
                            {parent.name}
                            <ArrowUpRight className="h-3 w-3" aria-hidden />
                          </Link>
                        </KeyValue>
                      )}
                    </dl>
                  </Card>

                  <Card className="p-5">
                    <p className="text-2xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
                      Net flow
                    </p>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
                          <ArrowDownLeft className="h-3.5 w-3.5 text-success" aria-hidden /> In
                        </span>
                        <span className="tabular text-sm font-medium text-foreground">
                          {formatCurrency(totalIn, data.currency, { compact: true })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground-secondary">
                          <ArrowUpRight className="h-3.5 w-3.5 text-warning" aria-hidden /> Out
                        </span>
                        <span className="tabular text-sm font-medium text-foreground">
                          −{formatCurrency(totalOut, data.currency, { compact: true })}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Child budgets */}
              {children.length > 0 && (
                <div className="space-y-4">
                  <SectionLabel>{children.length} sub-budgets</SectionLabel>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {children.map((child) => {
                      const childUtil = child.limit > 0 ? (child.spent / child.limit) * 100 : 0;
                      return (
                        <Card key={child.id} interactive>
                          <Link
                            href={`/budgets/${child.id}`}
                            className="block space-y-3 p-5 focus-visible:outline-none"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{child.name}</p>
                              <span className="tabular text-2xs text-foreground-secondary">
                                {formatPercent(childUtil)}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="tabular font-display text-xl font-semibold text-foreground">
                                <AnimatedNumber value={child.spent} formatter={(v) => formatCurrency(v, child.currency, { compact: true })} />
                              </span>
                              <span className="text-2xs text-foreground-muted">
                                / <AnimatedNumber value={child.limit} formatter={(v) => formatCurrency(v, child.currency, { compact: true })} />
                              </span>
                            </div>
                            <ProgressBar value={childUtil} label="Sub-budget utilization" />
                          </Link>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

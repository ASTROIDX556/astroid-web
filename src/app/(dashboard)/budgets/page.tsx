'use client';

import Link from 'next/link';
import { PiggyBank } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { StatCard, SectionLabel } from '@/components/dashboard/stat-card';
import { ProgressBar } from '@/components/dashboard/risk-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PolicyShieldIllustration } from '@/components/illustrations';
import { useBudgets } from '@/hooks/use-queries';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { PageTransition } from '@/components/ui/motion';
import { BudgetAllocationChart } from '@/features/budgets/BudgetAllocationChart';
import { BudgetMatrix } from '@/features/budgets/BudgetMatrix';



export default function BudgetsPage() {
  const budgets = useBudgets();

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Govern"
        title="Budgets"
        description="Spend envelopes by organization, department, project and agent — with live utilization."
      />

      <QueryBoundary
        query={budgets}
        loading={
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            illustration={<PolicyShieldIllustration />}
            title="No budgets yet"
            description="Create a budget to cap how much your organization and agents can spend."
          />
        }
      >
        {(data) => {
          const totalLimit = data.reduce((sum, b) => sum + b.limit, 0);
          const totalSpent = data.reduce((sum, b) => sum + b.spent, 0);
          const totalRemaining = data.reduce((sum, b) => sum + b.remaining, 0);

          const chartData = data.map((b) => ({
            id: b.id,
            department: b.name,
            allocated: b.limit,
            consumed: b.spent,
            currency: b.currency,
          }));

          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Total limit"
                  rawNumber={totalLimit}
                  formatter={(val) => formatCurrency(val, 'USDC', { compact: true })}
                  icon={<PiggyBank className="h-4 w-4" aria-hidden />}
                />
                <StatCard
                  label="Total spent"
                  rawNumber={totalSpent}
                  formatter={(val) => formatCurrency(val, 'USDC', { compact: true })}
                  footer="across all envelopes"
                />
                <StatCard
                  label="Remaining"
                  rawNumber={totalRemaining}
                  formatter={(val) => formatCurrency(val, 'USDC', { compact: true })}
                  accent
                />
              </div>

              {/* Recharts Budget Allocation & Threshold Chart */}
              <BudgetAllocationChart data={chartData} />

              <SectionLabel>{data.length} budgets</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                {data.map((budget) => {
                  const utilization = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;
                  return (
                    <Card key={budget.id} interactive>
                      <Link href={`/budgets/${budget.id}`} className="block focus-visible:outline-none">
                        <CardContent className="space-y-4 pt-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">{budget.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" size="sm" className="capitalize">
                                  {budget.scope}
                                </Badge>
                                <Badge variant="neutral" size="sm" className="capitalize">
                                  {budget.period}
                                </Badge>
                                {budget.parentBudgetId && (
                                  <Badge variant="neutral" size="sm">
                                    sub-budget
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <span className="tabular text-2xs font-medium text-foreground-secondary">
                              {Math.round(utilization)}%
                            </span>
                          </div>

                          <div>
                            <p className="font-display text-2xl font-semibold leading-none tracking-tight tabular">
                              {formatCurrency(budget.spent, budget.currency, { compact: true })}
                              <span className="text-base font-normal text-foreground-muted">
                                {' '}
                                / {formatCurrency(budget.limit, budget.currency, { compact: true })}
                              </span>
                            </p>
                            <ProgressBar
                              value={utilization}
                              label="Budget utilization"
                              className="mt-2"
                            />
                          </div>

                          <p className="text-2xs text-foreground-muted">
                            {formatCurrency(budget.remaining, budget.currency, { compact: true })}{' '}
                            remaining · resets {formatRelativeTime(budget.resetsAt)}
                          </p>
                        </CardContent>
                      </Link>
                    </Card>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <SectionLabel>Department Allocation & Drill-Down Matrix</SectionLabel>
                <BudgetMatrix />
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

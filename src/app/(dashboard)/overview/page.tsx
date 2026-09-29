'use client';

import Link from 'next/link';
import {
  Wallet as WalletIcon,
  TrendingDown,
  Bot,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { StatCard, SectionLabel } from '@/components/dashboard/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { CashflowChart, CategoryBarChart, DonutChart, type DonutDatum } from '@/components/charts';
import { CATEGORICAL } from '@/components/charts';
import { useOverview, useBriefing, useBudgets } from '@/hooks/use-queries';
import { useAssistantStore } from '@/stores/ui-store';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/format';
import { PageTransition } from '@/components/ui/motion';
import { ProgressBar } from '@/components/dashboard/risk-badge';


const severityBadge: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  low: 'info',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

export default function OverviewPage() {
  const overview = useOverview();
  const briefing = useBriefing();
  const budgets = useBudgets();
  const openAssistant = useAssistantStore((s) => s.setOpen);

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Command Center"
        title="Overview"
        description="A live read on treasury health, agent spend, and anything that needs your attention today."
        actions={
          <Button variant="gold" leftIcon={<Sparkles className="h-4 w-4" />} onClick={() => openAssistant(true)}>
            Daily briefing
          </Button>
        }
      />

      {/* KPIs */}
      <QueryBoundary
        query={overview}
        loading={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
      >
        {(data) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total balance"
              rawNumber={data?.totalBalance ?? 0}
              formatter={(val) => formatCurrency(val, 'USD', { compact: true })}
              icon={<WalletIcon className="h-4 w-4" />}
              accent
              href="/wallets"
            />
            <StatCard
              label="Monthly spend"
              rawNumber={data?.monthlySpend ?? 0}
              formatter={(val) => formatCurrency(val, 'USD', { compact: true })}
              delta={data?.monthlySpendDelta}
              deltaLabel="vs last month"
              upIsGood={false}
              icon={<TrendingDown className="h-4 w-4" />}
              href="/analytics"
            />
            <StatCard
              label="Active agents"
              rawNumber={data?.activeAgents ?? 0}
              formatter={(val) => formatNumber(val)}
              icon={<Bot className="h-4 w-4" />}
              footer="Executing this month"
              href="/agents"
            />
            <StatCard
              label="Pending approvals"
              rawNumber={data?.pendingApprovals ?? 0}
              formatter={(val) => formatNumber(val)}
              icon={<ShieldAlert className="h-4 w-4" />}
              footer="Awaiting your review"
              href="/approvals"
            />
          </div>
        )}
      </QueryBoundary>

      {/* Cashflow + briefing */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Cashflow</CardTitle>
            <Link
              href="/analytics"
              className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
            >
              Full analytics <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </CardHeader>
          <CardContent>
            <QueryBoundary query={overview} loading={<div className="skeleton h-[260px] w-full rounded-md" />}>
              {(data) => <CashflowChart data={data?.cashflow} />}
            </QueryBoundary>
          </CardContent>
        </Card>

        {/* AI briefing */}
        <Card elevation="soft" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gold-sheen" aria-hidden />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" aria-hidden />
              Briefing
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <QueryBoundary
              query={briefing}
              loading={
                <div className="space-y-3">
                  <div className="skeleton h-4 w-3/4 rounded-sm" />
                  <div className="skeleton h-16 w-full rounded-sm" />
                  <div className="skeleton h-16 w-full rounded-sm" />
                </div>
              }
            >
              {(data) => (
                <div className="space-y-4">
                  <div>
                    <p className="font-display text-base font-semibold">{data?.greeting ?? 'Financial Executive Briefing'}</p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground-secondary">
                      {data?.summary ?? 'Treasury systems operating normally.'}
                    </p>
                  </div>
                  <ul className="space-y-2.5">
                    {(data?.insights ?? []).slice(0, 3).map((insight) => (
                      <li
                        key={insight.id}
                        className="rounded-sm border border-border bg-surface/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-foreground">{insight.title}</p>
                          <Badge variant={severityBadge[insight.severity] ?? 'info'} size="sm">
                            {insight.severity}
                          </Badge>
                        </div>
                        <p className="mt-1 text-2xs leading-relaxed text-foreground-secondary">
                          {insight.detail}
                        </p>
                        {insight.action && (
                          <Link
                            href={insight.action.href}
                            className="mt-1.5 inline-flex items-center gap-1 text-2xs font-medium text-gold-strong hover:underline"
                          >
                            {insight.action.label}
                            <ArrowUpRight className="h-3 w-3" aria-hidden />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => openAssistant(true)}
                  >
                    Open assistant
                  </Button>
                  <p className="text-center text-2xs text-foreground-muted">
                    Generated {data?.generatedAt ? formatRelativeTime(data.generatedAt) : 'just now'}
                  </p>
                </div>
              )}
            </QueryBoundary>
          </CardContent>
        </Card>
      </div>

      {/* Spend breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend by category</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryBoundary query={overview} loading={<div className="skeleton h-[260px] w-full rounded-md" />}>
              {(data) => <CategoryBarChart data={data?.spendingByCategory} />}
            </QueryBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <QueryBoundary query={overview} loading={<div className="skeleton h-[220px] w-full rounded-md" />}>
              {(data) => {
                const list = data?.riskDistribution ?? [];
                const donut: DonutDatum[] = list.map((r, i) => ({
                  name: r.level,
                  value: r.count,
                  color: CATEGORICAL[i % CATEGORICAL.length],
                }));
                const total = list.reduce((sum, r) => sum + r.count, 0);
                return (
                  <DonutChart
                    data={donut}
                    centerLabel="Assessed"
                    centerValue={formatNumber(total)}
                  />
                );
              }}
            </QueryBoundary>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <SectionLabel className="mb-4">Where spend is going</SectionLabel>
          <QueryBoundary query={overview} loading={<SkeletonCard />}>
            {(data) => (
              <Card>
                <CardContent className="divide-y divide-border p-0">
                  {(data?.agentSpend ?? []).map((agent) => (
                    <Link
                      key={agent.agentId}
                      href={`/agents/${agent.agentId}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-secondary/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-secondary text-foreground-secondary">
                          <Bot className="h-4 w-4" aria-hidden />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{agent.agentName}</p>
                          <p className="text-2xs capitalize text-foreground-secondary">
                            {agent.role} · {formatNumber(agent.transactions)} transactions
                          </p>
                        </div>
                      </div>

                      <span className="tabular font-display text-lg font-semibold">
                        {formatCurrency(agent.spent, 'USD', { compact: true })}
                      </span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </QueryBoundary>
        </div>

        <div>
          <SectionLabel className="mb-4">Department budgets</SectionLabel>
          <QueryBoundary
            query={budgets}
            loading={
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="skeleton h-4 w-28 rounded-sm" />
                  <div className="skeleton h-16 w-full rounded-sm" />
                  <div className="skeleton h-16 w-full rounded-sm" />
                </CardContent>
              </Card>
            }
          >
            {(data) => {
              const departments = [...data]
                .filter((budget) => budget.scope === 'department' && budget.parentBudgetId)
                .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
                .slice(0, 4);

              return (
                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-3">
                    <CardTitle>Department budgets</CardTitle>
                    <Link href="/budgets" className="text-2xs font-medium text-foreground-secondary hover:text-foreground">
                      View all
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {departments.map((budget) => {
                      const utilization = budget.limit > 0 ? (budget.spent / budget.limit) * 100 : 0;

                      return (
                        <div key={budget.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{budget.name}</p>
                              <p className="text-2xs text-foreground-secondary">
                                {formatCurrency(budget.spent, budget.currency, { compact: true })} /{' '}
                                {formatCurrency(budget.limit, budget.currency, { compact: true })}
                              </p>
                            </div>
                            <span className="text-2xs font-medium text-foreground-secondary">
                              {Math.round(utilization)}%
                            </span>
                          </div>
                          <ProgressBar value={utilization} label={`${budget.name} utilization`} />
                          <p className="text-2xs text-foreground-muted">
                            {formatCurrency(budget.remaining, budget.currency, { compact: true })} remaining
                          </p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            }}
          </QueryBoundary>
        </div>
      </div>
    </PageTransition>
  );
}

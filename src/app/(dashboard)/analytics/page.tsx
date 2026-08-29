'use client';

import { BarChart3, Bot, Gauge, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AgentSpendChart,
  CATEGORICAL,
  CashflowChart,
  CategoryBarChart,
  DonutChart,
  WaterfallChart,
  type DonutDatum,
} from '@/components/charts';
import { useOverview } from '@/hooks/use-queries';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { PageTransition } from '@/components/ui/motion';
import { NvidiaAssistantWidget } from '@/features/chat/NvidiaAssistantWidget';

const chartSkeleton = <div className="skeleton h-[260px] w-full rounded-md" />;

export default function AnalyticsPage() {
  const overview = useOverview();

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Command Center"
        title="Analytics"
        description="Treasury performance, cashflow and agent spend — every figure traceable to an on-chain movement."
      />

      <QueryBoundary
        query={overview}
        loading={
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-36 w-full rounded-card" />
              ))}
            </div>
            {chartSkeleton}
          </div>
        }
      >
        {(data) => {
          const riskTotal = data.riskDistribution.reduce((sum, r) => sum + r.count, 0);
          const donut: DonutDatum[] = data.riskDistribution.map((r, i) => ({
            name: r.level,
            value: r.count,
            color: CATEGORICAL[i % CATEGORICAL.length],
          }));

          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total balance"
                  rawNumber={data.totalBalance}
                  formatter={(val) => formatCurrency(val, 'USDC', { compact: true })}
                  accent
                  href="/wallets"
                  icon={<Wallet className="h-4 w-4" aria-hidden />}
                />
                <StatCard
                  label="Monthly spend"
                  rawNumber={data.monthlySpend}
                  formatter={(val) => formatCurrency(val, 'USDC', { compact: true })}
                  delta={data.monthlySpendDelta}
                  deltaLabel="vs last month"
                  upIsGood={false}
                  icon={<BarChart3 className="h-4 w-4" aria-hidden />}
                />
                <StatCard
                  label="Budget utilization"
                  rawNumber={data.budgetUtilization}
                  formatter={(val) => formatPercent(val)}
                  footer="of company operating budget"
                  icon={<Gauge className="h-4 w-4" aria-hidden />}
                />
                <StatCard
                  label="Active agents"
                  rawNumber={data.activeAgents}
                  formatter={(val) => formatNumber(val)}
                  footer="operating within policy"
                  href="/agents"
                  icon={<Bot className="h-4 w-4" aria-hidden />}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Cashflow</CardTitle>
                </CardHeader>
                <CardContent>
                  <CashflowChart data={data.cashflow} />
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Spend by category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CategoryBarChart data={data.spendingByCategory} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Risk distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DonutChart
                      data={donut}
                      centerLabel="Assessed"
                      centerValue={formatNumber(riskTotal)}
                    />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Agent spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <AgentSpendChart data={data.agentSpend} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Budget waterfall</CardTitle>
                </CardHeader>
                <CardContent>
                  <WaterfallChart data={data.budgetWaterfall} />
                </CardContent>
              </Card>

              <div className="pt-4 border-t border-border space-y-4">
                <h3 className="font-display text-lg font-semibold tracking-tight">Interactive Nvidia NIM AI Briefings & Assistant</h3>
                <NvidiaAssistantWidget />
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

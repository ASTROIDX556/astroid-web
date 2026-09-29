'use client';

import Link from 'next/link';
import { ArrowLeft, Wallet as WalletIcon, BrainCircuit, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue, SectionLabel } from '@/components/dashboard/stat-card';
import { ProgressBar } from '@/components/dashboard/risk-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAgent } from '@/hooks/use-queries';
import { agentStatus } from '@/lib/status';
import { formatCurrency, formatNumber, formatDateTime, formatRelativeTime } from '@/lib/format';
import { PageTransition, AnimatedNumber } from '@/components/ui/motion';
import { AgentProviderConfigForm } from '@/features/agents/components/AgentProviderConfigForm';

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const agent = useAgent(params.id);

  return (
    <PageTransition className="space-y-8">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to agents
      </Link>

      <QueryBoundary
        query={agent}
        loading={
          <div className="space-y-6">
            <div className="skeleton h-24 w-full rounded-card" />
            <div className="skeleton h-64 w-full rounded-card" />
          </div>
        }
      >
        {(data) => {
          const status = agentStatus(data.status);
          const remaining = data.monthlyBudget - data.budgetSpent;
          const utilization =
            data.monthlyBudget > 0 ? (data.budgetSpent / data.monthlyBudget) * 100 : 0;
          return (
            <div className="space-y-8">
              <PageHeader
                eyebrow={`${data.role} agent`}
                title={data.name}
                description={data.description}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant} dot>
                      {status.label}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {data.mode}
                    </Badge>
                  </div>
                }
              />

              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardContent className="pt-5">
                    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                      <KeyValue label="Provider">{data.provider}</KeyValue>
                      <KeyValue label="Model" mono>
                        {data.model}
                      </KeyValue>
                      <KeyValue label="Mode">
                        <span className="capitalize">{data.mode}</span>
                      </KeyValue>
                      <KeyValue label="Monthly budget">
                        {formatCurrency(data.monthlyBudget, 'USDC')}
                      </KeyValue>
                      <KeyValue label="Spent">
                        {formatCurrency(data.budgetSpent, 'USDC')}
                      </KeyValue>
                      <KeyValue label="Remaining">
                        {formatCurrency(remaining, 'USDC')}
                      </KeyValue>
                      <KeyValue label="Created">{formatDateTime(data.createdAt)}</KeyValue>
                      <KeyValue label="Last active">
                        {formatRelativeTime(data.lastActiveAt)}
                      </KeyValue>
                      <KeyValue label="Policies">
                        <Link href="/policies" className="text-gold-strong hover:underline">
                          {formatNumber(data.policyIds.length)} attached
                        </Link>
                      </KeyValue>
                    </dl>
                  </CardContent>
                </Card>

                <Card elevation="soft">
                  <CardHeader>
                    <CardTitle className="text-sm">Budget utilization</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="font-display text-4xl font-semibold leading-none tracking-tight tabular">
                      <AnimatedNumber value={utilization} formatter={(v) => Math.round(v) + '%'} />
                    </p>
                    <ProgressBar value={utilization} label="Budget utilization" />
                    <p className="text-2xs text-foreground-secondary">
                      <AnimatedNumber value={data.budgetSpent} formatter={(v) => formatCurrency(v, 'USDC')} /> of{' '}
                      <AnimatedNumber value={data.monthlyBudget} formatter={(v) => formatCurrency(v, 'USDC')} /> spent this month
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <SectionLabel>Capabilities</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {data.capabilities.map((cap) => (
                    <Badge key={cap} variant="outline">
                      <ShieldCheck className="mr-1 h-3 w-3 text-gold" aria-hidden />
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {data.walletId && (
                  <Link href={`/wallets/${data.walletId}`} className="block">
                    <Card interactive className="flex items-center gap-3 p-4">
                      <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-secondary text-foreground-secondary">
                        <WalletIcon className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Linked wallet</p>
                        <p className="text-2xs text-foreground-secondary">
                          View balances & activity
                        </p>
                      </div>
                    </Card>
                  </Link>
                )}
                {data.memoryId && (
                  <Link href={`/memory/${data.memoryId}`} className="block">
                    <Card interactive className="flex items-center gap-3 p-4">
                      <span className="grid h-9 w-9 place-items-center rounded-md bg-gold-soft text-gold-strong">
                        <BrainCircuit className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Financial memory</p>
                        <p className="text-2xs text-foreground-secondary">
                          Reconstructed decision trail
                        </p>
                      </div>
                    </Card>
                  </Link>
                )}
              </div>

              <div className="space-y-4">
                <SectionLabel>Provider configuration</SectionLabel>
                <AgentProviderConfigForm
                  defaultValues={{
                    name: `${data.name} — provider`,
                    model: data.model,
                  }}
                />
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

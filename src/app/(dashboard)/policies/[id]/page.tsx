'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Gauge, Play, ShieldAlert, X } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue, SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePolicy, usePolicySimulation } from '@/hooks/use-queries';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/format';
import type { PolicySimulationResult } from '@/types/domain';
import { PageTransition, AnimatedNumber } from '@/components/ui/motion';
import { TransactionSimulator } from '@/features/policies/TransactionSimulator';
import { PolicyForm } from '@/features/policies/components/PolicyForm';

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

const outcomeMeta: Record<
  PolicySimulationResult['predictedOutcome'],
  { label: string; variant: 'success' | 'warning' | 'danger' }
> = {
  auto_execute: { label: 'Auto-execute', variant: 'success' },
  requires_approval: { label: 'Requires approval', variant: 'warning' },
  blocked: { label: 'Blocked', variant: 'danger' },
};

function renderConfigValue(value: string | number | boolean | string[]): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default function PolicyDetailPage({ params }: { params: { id: string } }) {
  const policy = usePolicy(params.id);
  const sim = usePolicySimulation();
  const [amount, setAmount] = useState(1000);
  const [isPolicyBuilderOpen, setIsPolicyBuilderOpen] = useState(false);

  return (
    <PageTransition className="space-y-8">
      <Link
        href="/policies"
        className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to policies
      </Link>

      <QueryBoundary
        query={policy}
        loading={
          <div className="space-y-6">
            <div className="skeleton h-24 w-full rounded-card" />
            <div className="skeleton h-64 w-full rounded-card" />
          </div>
        }
      >
        {(data) => {
          const config = Object.entries(data.configuration);
          return (
            <div className="space-y-8">
              <PageHeader
                eyebrow={titleCase(data.type)}
                title={data.name}
                description={data.description}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge variant={data.enabled ? 'success' : 'neutral'} dot>
                      {data.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPolicyBuilderOpen((open) => !open)}
                      aria-expanded={isPolicyBuilderOpen}
                      leftIcon={<ShieldAlert className="h-4 w-4" aria-hidden />}
                    >
                      {isPolicyBuilderOpen ? 'Close builder' : 'Policy builder'}
                    </Button>
                  </div>
                }
              />

              <Card className="p-5">
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <KeyValue label="Type">{titleCase(data.type)}</KeyValue>
                  <KeyValue label="Priority">{formatNumber(data.priority)}</KeyValue>
                  <KeyValue label="Status">
                    {data.enabled ? 'Enabled' : 'Disabled'}
                  </KeyValue>
                  <KeyValue label="Applies to">
                    {formatNumber(data.appliesTo)}{' '}
                    {data.appliesTo === 1 ? 'agent' : 'agents'}
                  </KeyValue>
                  <KeyValue label="Violations (30d)">
                    {data.violations30d > 0 ? (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                        {formatNumber(data.violations30d)}
                      </span>
                    ) : (
                      formatNumber(data.violations30d)
                    )}
                  </KeyValue>
                  <KeyValue label="Created">{formatDateTime(data.createdAt)}</KeyValue>
                </dl>
              </Card>

              {config.length > 0 && (
                <div className="space-y-4">
                  <SectionLabel>Configuration</SectionLabel>
                  <Card className="p-5">
                    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                      {config.map(([key, value]) => (
                        <KeyValue key={key} label={titleCase(key)}>
                          {renderConfigValue(value)}
                        </KeyValue>
                      ))}
                    </dl>
                  </Card>
                </div>
              )}

              {isPolicyBuilderOpen && (
                <div className="space-y-4">
                  <SectionLabel>Policy builder</SectionLabel>
                  <Card className="p-5">
                    <PolicyForm />
                  </Card>
                </div>
              )}

              <div className="space-y-4">
                <SectionLabel>Policy simulator</SectionLabel>
                <Card elevation="soft" className="relative overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 bg-gold-sheen" aria-hidden />
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Gauge className="h-4 w-4 text-gold" aria-hidden />
                      Dry-run a spend against every active policy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="flex-1">
                        <span className="mb-1.5 block text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
                          Amount (USDC)
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                          leftIcon={<span className="text-sm">$</span>}
                        />
                      </label>
                      <Button
                        variant="gold"
                        leftIcon={<Play className="h-4 w-4" />}
                        loading={sim.isPending}
                        onClick={() => sim.mutate(amount)}
                      >
                        Run simulation
                      </Button>
                    </div>

                    {sim.data && (
                      <SimulationResult result={sim.data} />
                    )}
                  </CardContent>
                </Card>

                <TransactionSimulator />
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

function SimulationResult({ result }: { result: PolicySimulationResult }) {
  const outcome = outcomeMeta[result.predictedOutcome];
  return (
    <div className="space-y-5 rounded-card border border-border bg-surface/70 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={outcome.variant} dot>
          {outcome.label}
        </Badge>
        <span
          className={`inline-flex items-center gap-1 text-2xs font-medium ${
            result.passed ? 'text-success' : 'text-danger'
          }`}
        >
          {result.passed ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <X className="h-3.5 w-3.5" aria-hidden />
          )}
          {result.passed ? 'Passes all policies' : 'Blocked by policy'}
        </span>
      </div>

      <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <KeyValue label="Estimated risk">
          <RiskBadge score={result.estimatedRisk} showScore />
        </KeyValue>
        <KeyValue label="Required approvals">
          <AnimatedNumber value={result.requiredApprovals} formatter={(v) => formatNumber(v)} />
        </KeyValue>
        <KeyValue label="Budget">{result.budgetImpact.name}</KeyValue>
        <KeyValue label="Remaining after">
          <AnimatedNumber value={result.budgetImpact.remainingAfter} formatter={(v) => formatCurrency(v, 'USDC')} />
        </KeyValue>
      </dl>

      {result.triggeredPolicies.length > 0 && (
        <div className="space-y-2">
          <p className="text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
            Triggered policies
          </p>
          <ul className="space-y-1.5">
            {result.triggeredPolicies.map((tp) => (
              <li
                key={tp.policyId}
                className="flex items-center justify-between rounded-sm border border-border bg-surface px-3 py-2 text-xs"
              >
                <span className="text-foreground">{tp.name}</span>
                <span
                  className={`inline-flex items-center gap-1 text-2xs font-medium ${
                    tp.passed ? 'text-success' : 'text-danger'
                  }`}
                >
                  {tp.passed ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <X className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {tp.passed ? 'Pass' : 'Fail'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

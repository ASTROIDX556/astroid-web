'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BrainCircuit,
  Fingerprint,
  Layers,
  ShieldCheck,
  Wallet as WalletIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue, SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMemoryRecord } from '@/hooks/use-queries';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDateTime, truncateHash } from '@/lib/format';
import type { MemoryStep, MemoryStepKind } from '@/types/domain';
import { PageTransition, AnimatedNumber } from '@/components/ui/motion';

const stepTone: Record<MemoryStepKind, string> = {
  conversation: 'bg-info-soft text-info',
  decision: 'bg-gold-soft text-gold-strong',
  policy: 'bg-warning-soft text-warning',
  approval: 'bg-success-soft text-success',
  blockchain: 'bg-surface-secondary text-foreground',
};

function StepIcon({ kind }: { kind: MemoryStepKind }) {
  const base = 'h-4 w-4';
  switch (kind) {
    case 'conversation':
      return <Layers className={base} aria-hidden />;
    case 'decision':
      return <BrainCircuit className={base} aria-hidden />;
    case 'policy':
      return <ShieldCheck className={base} aria-hidden />;
    case 'approval':
      return <WalletIcon className={base} aria-hidden />;
    case 'blockchain':
      return <Fingerprint className={base} aria-hidden />;
  }
}

/** Derive the locking/stepping sequence from a memory-record trail. */
function chronological(steps: MemoryStep[]): MemoryStep[] {
  return [...steps].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export default function AuditDetailPage({ params }: { params: { id: string } }) {
  const record = useMemoryRecord(params.id);

  return (
    <PageTransition className="space-y-8">
      <Link
        href="/audit"
        className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to audit log
      </Link>

      <QueryBoundary
        query={record}
        loading={
          <div className="space-y-6">
            <div className="skeleton h-24 w-full rounded-card" />
            <div className="skeleton h-64 w-full rounded-card" />
          </div>
        }
      >
        {(data) => {
          const steps = chronological(data.steps);
          const executed = data.stellarHash !== undefined;
          return (
            <div className="space-y-8">
              <PageHeader
                eyebrow={`Audit record · ${data.id}`}
                title={data.task}
                description={data.summary}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge variant={executed ? 'success' : 'warning'} dot>
                      {executed ? 'Settled on-chain' : 'Recorded'}
                    </Badge>
                    <RiskBadge score={data.riskScore} showScore />
                  </div>
                }
              />

              {/* Immutable envelope */}
              <Card className="relative overflow-hidden bg-surface-secondary">
                <div
                  className="pointer-events-none absolute inset-0 bg-gold-sheen opacity-40"
                  aria-hidden
                />
                <CardContent className="relative pt-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-2xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
                        Signed amount
                      </p>
                      <p className="tabular mt-1 font-display text-4xl font-semibold leading-none tracking-tight">
                        <AnimatedNumber
                          value={data.amount}
                          formatter={(v) => formatCurrency(v, data.asset)}
                        />
                      </p>
                    </div>
                    <dl className="grid gap-3 text-right sm:text-left">
                      <KeyValue label="Record ID" mono>
                        {truncateHash(data.id, 4, 0)}
                      </KeyValue>
                      <KeyValue label="Recorded">
                        {formatDateTime(data.createdAt)}
                      </KeyValue>
                    </dl>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Reconstructed trail */}
                <div className="space-y-4 lg:col-span-2">
                  <SectionLabel>Decision chain</SectionLabel>
                  <ol className="relative space-y-0 pl-9">
                    {steps.map((step, i) => (
                      <li key={`${step.kind}-${i}`} className="relative pb-6">
                        {i < steps.length - 1 && (
                          <span
                            className="absolute -left-[13px] top-7 h-full w-px bg-border"
                            aria-hidden
                          />
                        )}
                        <span
                          className={cn(
                            'absolute -left-[22px] top-0 grid h-9 w-9 place-items-center rounded-md border border-surface',
                            stepTone[step.kind],
                          )}
                        >
                          <StepIcon kind={step.kind} />
                        </span>
                        <div className="ml-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {step.title}
                            </p>
                            <span className="text-2xs font-medium uppercase tracking-wide text-foreground-muted">
                              {step.kind}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-foreground-secondary">
                            {step.detail}
                          </p>
                          <p className="mt-1 text-2xs text-foreground-muted">
                            {step.actor} · {formatDateTime(step.timestamp)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Evidence rail */}
                <div className="space-y-4">
                  <SectionLabel>Evidence</SectionLabel>
                  <Card className="p-5">
                    <dl className="grid gap-4">
                      <KeyValue label="Agent">
                        <Link
                          href={`/agents/${data.agentId}`}
                          className="text-gold-strong hover:underline"
                        >
                          {data.agentName}
                        </Link>
                      </KeyValue>
                      <KeyValue label="Project">{data.project}</KeyValue>
                      <KeyValue label="Conversation" mono>
                        {data.conversationId}
                      </KeyValue>
                      <KeyValue label="Policy evaluated">{data.policyUsed}</KeyValue>
                      <KeyValue label="Risk">
                        <RiskBadge score={data.riskScore} showScore />
                      </KeyValue>
                      <KeyValue label="Approvals">
                        {data.approvedBy.length > 0
                          ? data.approvedBy.join(', ')
                          : 'Autonomous'}
                      </KeyValue>
                      <KeyValue label="Transaction">
                        <Link
                          href={`/transactions/${data.transactionId}`}
                          className="text-gold-strong hover:underline"
                        >
                          {truncateHash(data.transactionId, 0, 0)}
                        </Link>
                      </KeyValue>
                      {data.stellarHash && (
                        <KeyValue label="Stellar hash" mono>
                          {truncateHash(data.stellarHash, 6, 6)}
                        </KeyValue>
                      )}
                    </dl>
                  </Card>

                  <Card elevation="flat" className="p-4">
                    <p className="text-2xs leading-relaxed text-foreground-secondary">
                      This entry is append-only and cryptographically sealed. Tampering
                      would invalidate downstream signer hashes and be detectable during
                      reconciliation.
                    </p>
                  </Card>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" size="sm" className="capitalize">
                  agent · {data.agentId.slice(0, 8)}
                </Badge>
                <Badge variant="outline" size="sm" className="capitalize">
                  project · {data.project}
                </Badge>
                <Badge variant="neutral" size="sm">
                  {steps.length} trail steps
                </Badge>
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Boxes,
  BrainCircuit,
  MessagesSquare,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue, SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemoryRecord } from '@/hooks/use-queries';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { MemoryStepKind } from '@/types/domain';
import { PageTransition, AnimatedNumber } from '@/components/ui/motion';
import { cn } from '@/lib/cn';

const stepStyle: Record<
  MemoryStepKind,
  { icon: LucideIcon; ring: string; tone: string }
> = {
  conversation: {
    icon: MessagesSquare,
    ring: 'bg-info-soft text-info',
    tone: 'text-info',
  },
  decision: {
    icon: BrainCircuit,
    ring: 'bg-gold-soft text-gold-strong',
    tone: 'text-gold-strong',
  },
  policy: {
    icon: ShieldCheck,
    ring: 'bg-warning-soft text-warning',
    tone: 'text-warning',
  },
  approval: {
    icon: UserCheck,
    ring: 'bg-success-soft text-success',
    tone: 'text-success',
  },
  blockchain: {
    icon: Boxes,
    ring: 'bg-surface-secondary text-foreground',
    tone: 'text-foreground',
  },
};

export default function MemoryDetailPage({ params }: { params: { id: string } }) {
  const record = useMemoryRecord(params.id);

  return (
    <PageTransition className="space-y-8">
      <Link
        href="/memory"
        className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to memory
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
        {(data) => (
          <div className="space-y-8">
            <PageHeader
              eyebrow={data.agentName}
              title={data.task}
              description={data.project}
              actions={<RiskBadge score={data.riskScore} showScore />}
            />

            <Card elevation="soft" className="relative overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0 bg-gold-sheen"
                aria-hidden
              />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-gold" aria-hidden />
                  What happened
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <p className="max-w-prose text-sm leading-relaxed text-foreground-secondary">
                  {data.summary}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <KeyValue label="Reason" className="sm:col-span-2 lg:col-span-3">
                    {data.reason}
                  </KeyValue>
                  <KeyValue label="Amount">
                    <AnimatedNumber
                      value={data.amount}
                      formatter={(v) => formatCurrency(v, data.asset)}
                    />
                  </KeyValue>
                  <KeyValue label="Policy used">{data.policyUsed}</KeyValue>
                  <KeyValue label="Approved by">
                    {data.approvedBy.length > 0 ? (
                      data.approvedBy.join(', ')
                    ) : (
                      <span className="text-foreground-secondary">
                        Autonomous — no human approval
                      </span>
                    )}
                  </KeyValue>
                  <KeyValue label="Transaction">
                    <Link
                      href={`/transactions/${data.transactionId}`}
                      className="text-gold-strong hover:underline"
                    >
                      {data.transactionId}
                    </Link>
                  </KeyValue>
                  <KeyValue label="Conversation" mono>
                    {data.conversationId}
                  </KeyValue>
                  {data.stellarHash && (
                    <KeyValue label="Stellar hash" mono>
                      {`${data.stellarHash.slice(0, 8)}…${data.stellarHash.slice(-6)}`}
                    </KeyValue>
                  )}
                </dl>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <SectionLabel>Decision trail</SectionLabel>
              <ol className="relative space-y-6 pl-2">
                {data.steps.map((step, i) => {
                  const style = stepStyle[step.kind];
                  const Icon = style.icon;
                  const last = i === data.steps.length - 1;
                  const meta = Object.entries(step.meta ?? {});
                  return (
                    <li key={`${step.kind}-${i}`} className="relative flex gap-4">
                      <div className="relative flex flex-col items-center">
                        <span
                          className={cn(
                            'z-10 grid h-9 w-9 shrink-0 place-items-center rounded-md',
                            style.ring,
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        {!last && (
                          <span
                            className="absolute top-9 h-[calc(100%+0.5rem)] w-px bg-border"
                            aria-hidden
                          />
                        )}
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {step.title}
                          </p>
                          <span
                            className={cn(
                              'text-2xs font-medium uppercase tracking-wide',
                              style.tone,
                            )}
                          >
                            {step.kind}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground-secondary">
                          {step.detail}
                        </p>
                        <p className="mt-1.5 text-2xs text-foreground-muted">
                          {step.actor} · {formatDateTime(step.timestamp)}
                        </p>
                        {meta.length > 0 && (
                          <div className="gap-1.5 mt-2 flex flex-wrap">
                            {meta.map(([key, value]) => (
                              <span
                                key={key}
                                className="py-0.5 inline-flex items-center gap-1 rounded-xs border border-border bg-surface px-2 text-2xs text-foreground-secondary"
                              >
                                <span className="text-foreground-muted">{key}</span>
                                <span className="tabular">{value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </QueryBoundary>
    </PageTransition>
  );
}

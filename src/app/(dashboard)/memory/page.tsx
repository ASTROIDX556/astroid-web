'use client';

import Link from 'next/link';
import { ArrowUpRight, BrainCircuit } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { MemoryIllustration } from '@/components/illustrations';
import { useMemoryRecords } from '@/hooks/use-queries';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { PageTransition } from '@/components/ui/motion';

export default function MemoryPage() {
  const records = useMemoryRecords();

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Command Center"
        title="Financial Memory"
        description="Every autonomous decision, reconstructed end to end — from the triggering conversation to the on-chain settlement."
      />

      <QueryBoundary
        query={records}
        loading={
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            illustration={<MemoryIllustration />}
            title="No memory records yet"
            description="Once your agents start executing governed transactions, each decision trail will appear here."
          />
        }
      >
        {(data) => (
          <div className="space-y-6">
            <SectionLabel>{data.length} decision trails</SectionLabel>
            <div className="space-y-4">
              {data.map((record) => (
                <Link key={record.id} href={`/memory/${record.id}`} className="block">
                  <Card interactive className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gold-soft text-gold-strong">
                          <BrainCircuit className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {record.agentName}
                            </p>
                            <Badge variant="outline" size="sm">
                              {record.project}
                            </Badge>
                            <RiskBadge score={record.riskScore} showScore />
                          </div>
                          <p className="text-xs leading-relaxed text-foreground-secondary">
                            {record.summary}
                          </p>
                          <p className="text-2xs text-foreground-muted">
                            {record.steps.length} steps ·{' '}
                            {formatRelativeTime(record.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                        <span className="tabular font-display text-lg font-semibold">
                          {formatCurrency(record.amount, record.asset, {
                            compact: true,
                          })}
                        </span>
                        <ArrowUpRight
                          className="h-4 w-4 text-foreground-muted"
                          aria-hidden
                        />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </QueryBoundary>
    </PageTransition>
  );
}

'use client';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BellIllustration } from '@/components/illustrations';
import { useProposals } from '@/hooks/use-queries';
import { PageTransition } from '@/components/ui/motion';
import { ProposalReviewWorkflow } from '@/features/proposals/ProposalReviewWorkflow';

export default function ApprovalsPage() {
  const proposals = useProposals();

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Operate"
        title="Approvals"
        description="Pending decisions awaiting your review — every one traceable to a proposed transaction."
      />

      <ErrorBoundary section="Approvals queue">
        <QueryBoundary
          query={proposals}
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
              illustration={<BellIllustration />}
              title="Nothing to approve"
              description="You're all caught up. New proposals will appear here as agents request approval."
            />
          }
        >
          {(data) => <ProposalReviewWorkflow proposals={data} />}
        </QueryBoundary>
      </ErrorBoundary>
    </PageTransition>
  );
}

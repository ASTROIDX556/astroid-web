'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { SectionLabel } from '@/components/dashboard/stat-card';
import { PageTransition } from '@/components/ui/motion';
import { SignerManagement } from '@/features/multisig';
import { MultisigProgressCard } from '@/features/approvals/components/MultisigProgressCard';
import { mockMultisigRequest } from '@/features/approvals/fixtures/multisig';

export default function MultisigPage() {
  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Operate"
        title="Multi-Sig Signers"
        description="View, add and remove co-signers, tune the master key thresholds and propose the whole change set to your organization's multi-signature Stellar account."
      />
      <SignerManagement />

      <section className="space-y-4">
        <div className="space-y-1.5">
          <SectionLabel>In-flight signing progress</SectionLabel>
          <p className="max-w-prose text-xs text-foreground-secondary">
            Collected weight against the account threshold for the pending multi-signature
            request, with each co-signer&apos;s decision.
          </p>
        </div>
        <MultisigProgressCard request={mockMultisigRequest} />
      </section>
    </PageTransition>
  );
}

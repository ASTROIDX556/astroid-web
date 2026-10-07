'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { PageTransition } from '@/components/ui/motion';
import { SignerManagement } from '@/features/multisig';

export default function MultisigPage() {
  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Operate"
        title="Multi-Sig Signers"
        description="View, add and remove co-signers, tune the master key thresholds and propose the whole change set to your organization's multi-signature Stellar account."
      />
      <SignerManagement />
    </PageTransition>
  );
}

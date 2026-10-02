'use client';

import { PageTransition } from '@/components/ui/motion';
import { SignerManagement } from '@/features/multisig/SignerManagement';

export default function MultisigPage() {
  return (
    <PageTransition className="space-y-8">
      <SignerManagement />
    </PageTransition>
  );
}

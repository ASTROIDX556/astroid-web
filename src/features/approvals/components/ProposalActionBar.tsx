'use client';

import { useState } from 'react';
import { Check, MessageSquareText, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useProposalApproval } from '@/hooks/useProposalApproval';
import type { LocalApprovalDecision } from '@/stores/proposal-approval-store';
import type { Proposal } from '@/types/domain';

import { ProposalApprovalConfirmDialog } from './ProposalApprovalConfirmDialog';

export function ProposalActionBar({ proposal }: { proposal: Proposal }) {
  const { decision, isProcessing } = useProposalApproval(proposal);
  const [action, setAction] = useState<LocalApprovalDecision | null>(null);
  const pending = proposal.status === 'pending' && !decision;

  if (!pending) return null;

  return (
    <>
      <div
        role="group"
        aria-label="Proposal review actions"
        className="flex flex-wrap items-center gap-2"
      >
        <Button
          type="button"
          variant="gold"
          size="sm"
          disabled={isProcessing}
          leftIcon={<Check className="h-4 w-4" aria-hidden />}
          onClick={() => setAction('approved')}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={isProcessing}
          leftIcon={<X className="h-4 w-4" aria-hidden />}
          onClick={() => setAction('rejected')}
        >
          Reject
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isProcessing}
          leftIcon={<MessageSquareText className="h-4 w-4" aria-hidden />}
          onClick={() => setAction('changes_requested')}
        >
          Request changes
        </Button>
      </div>
      <ProposalApprovalConfirmDialog
        proposal={proposal}
        action={action}
        open={action !== null}
        onClose={() => setAction(null)}
      />
    </>
  );
}
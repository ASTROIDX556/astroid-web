import { describe, expect, it } from 'vitest';

import type { Proposal } from '@/types/domain';
import {
  ApprovalGuardError,
  applyApprovalDecision,
  checkApprovalGuard,
  computeQuorumStatus,
  findApprover,
  signatureSummary,
  type ApprovalActor,
} from './approval-state';

const marco: ApprovalActor = { id: 'usr_marco', name: 'Marco Vitale' };
const outsider: ApprovalActor = { id: 'usr_outsider', name: 'Outsider' };

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'prop_3',
    organizationId: 'org_nova',
    transactionId: 'txn_2c19',
    title: 'Linear — annual license renewal',
    description: 'Dual approval required.',
    status: 'pending',
    kind: 'dual',
    agentName: 'Vega',
    amount: 6_800,
    asset: 'USDC',
    counterparty: 'Linear',
    riskScore: 27,
    requiredApprovals: 2,
    approvals: [
      { id: 'apr_3', userId: 'usr_lin', userName: 'Lin Zhao', decision: 'pending' },
      {
        id: 'apr_4',
        userId: 'usr_marco',
        userName: 'Marco Vitale',
        decision: 'pending',
      },
    ],
    expiresAt: '2026-08-02T14:00:00.000Z',
    createdAt: '2026-07-28T14:02:00.000Z',
    ...overrides,
  };
}

describe('checkApprovalGuard', () => {
  it('allows a pending approver with a clean slot', () => {
    const result = checkApprovalGuard(proposal(), marco.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.approver?.id).toBe('apr_4');
    }
  });

  it('rejects proposals that are no longer pending', () => {
    for (const status of ['approved', 'rejected', 'expired', 'executed'] as const) {
      const result = checkApprovalGuard(proposal({ status }), marco.id);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('proposal_not_pending');
    }
  });

  it('rejects while another decision is in flight', () => {
    const result = checkApprovalGuard(proposal(), marco.id, { isProcessing: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('approval_in_progress');
  });

  it('rejects duplicate session decisions', () => {
    const result = checkApprovalGuard(proposal(), marco.id, { hasLocalDecision: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('duplicate_decision');
  });

  it('rejects actors without a roster slot', () => {
    const result = checkApprovalGuard(proposal(), outsider.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not_an_approver');
  });

  it('rejects slots the server already resolved', () => {
    const decided = proposal({
      approvals: [
        {
          id: 'apr_4',
          userId: 'usr_marco',
          userName: 'Marco Vitale',
          decision: 'approved',
        },
      ],
    });
    const result = checkApprovalGuard(decided, marco.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('duplicate_decision');
  });

  it('exposes typed guard errors for callers that throw', () => {
    const error = new ApprovalGuardError('duplicate_decision', 'Already decided.');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApprovalGuardError');
    expect(error.code).toBe('duplicate_decision');
  });
});

describe('applyApprovalDecision', () => {
  it('fills the actor roster slot without mutating the input proposal', () => {
    const original = proposal();
    const updated = applyApprovalDecision(original, marco, 'approved', {
      comment: 'Within budget.',
      timestamp: '2026-08-01T09:00:00.000Z',
    });

    expect(original.approvals[1]?.decision).toBe('pending');
    expect(original.status).toBe('pending');

    const slot = findApprover(updated, marco.id);
    expect(slot?.decision).toBe('approved');
    expect(slot?.comment).toBe('Within budget.');
    expect(slot?.createdAt).toBe('2026-08-01T09:00:00.000Z');
    expect(updated.status).toBe('pending');
  });

  it('flips the proposal to approved exactly at the quorum boundary', () => {
    const updated = applyApprovalDecision(
      proposal({
        approvals: [
          {
            id: 'apr_3',
            userId: 'usr_lin',
            userName: 'Lin Zhao',
            decision: 'approved',
          },
          {
            id: 'apr_4',
            userId: 'usr_marco',
            userName: 'Marco Vitale',
            decision: 'pending',
          },
        ],
      }),
      marco,
      'approved',
      { timestamp: '2026-08-01T09:00:00.000Z' },
    );

    expect(updated.status).toBe('approved');
    expect(computeQuorumStatus(updated, null).isQuorumMet).toBe(true);
  });

  it('records rejections without advancing the quorum', () => {
    const updated = applyApprovalDecision(proposal(), marco, 'rejected', {
      comment: 'Vendor needs review.',
      timestamp: '2026-08-01T09:00:00.000Z',
    });

    expect(findApprover(updated, marco.id)?.decision).toBe('rejected');
    expect(updated.status).toBe('pending');
    expect(computeQuorumStatus(updated, null).approvedWeight).toBe(0);
  });

  it('appends a decided entry for actors missing from the roster', () => {
    const updated = applyApprovalDecision(proposal(), outsider, 'approved', {
      timestamp: '2026-08-01T09:00:00.000Z',
    });

    const slot = findApprover(updated, outsider.id);
    expect(slot).not.toBeNull();
    expect(slot?.decision).toBe('approved');
    expect(slot?.userName).toBe('Outsider');
  });
});

describe('quorum helpers', () => {
  it('counts the local decision on top of server approvals without double counting', () => {
    const base = proposal({
      approvals: [
        { id: 'apr_3', userId: 'usr_lin', userName: 'Lin Zhao', decision: 'approved' },
        {
          id: 'apr_4',
          userId: 'usr_marco',
          userName: 'Marco Vitale',
          decision: 'pending',
        },
      ],
    });

    const withLocal = computeQuorumStatus(base, 'approved');
    expect(withLocal.approvedWeight).toBe(2);
    expect(withLocal.isQuorumMet).toBe(true);
    expect(withLocal.remaining).toBe(0);

    expect(computeQuorumStatus(base, null).approvedWeight).toBe(1);
    expect(computeQuorumStatus(base, 'rejected').approvedWeight).toBe(1);
  });

  it('formats signature progress and clamps at the required count', () => {
    const base = proposal({
      approvals: [
        { id: 'apr_3', userId: 'usr_lin', userName: 'Lin Zhao', decision: 'approved' },
        {
          id: 'apr_4',
          userId: 'usr_marco',
          userName: 'Marco Vitale',
          decision: 'approved',
        },
      ],
    });

    expect(signatureSummary(proposal(), null)).toBe('0 of 2 signatures collected');
    expect(signatureSummary(base, null)).toBe('2 of 2 signatures collected');

    const single = proposal({ requiredApprovals: 1, approvals: [] });
    expect(signatureSummary(single, null)).toBe('0 of 1 signature collected');
    expect(signatureSummary(single, 'approved')).toBe('1 of 1 signature collected');
  });
});

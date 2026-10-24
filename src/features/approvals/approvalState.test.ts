import assert from 'node:assert/strict';
import test from 'node:test';

import type { Proposal } from '../../types/domain';
import {
  applyDecision,
  approvalProgress,
  canReviewProposal,
  snapshotFromProposal,
} from './approvalState';

const proposal: Proposal = {
  id: 'prop_test',
  organizationId: 'org_test',
  transactionId: 'txn_test',
  title: 'Test proposal',
  description: 'Exercises approval state transitions.',
  status: 'pending',
  kind: 'dual',
  agentName: 'Atlas',
  amount: 1_000,
  asset: 'USDC',
  counterparty: 'Vendor',
  riskScore: 10,
  requiredApprovals: 2,
  approvals: [
    {
      id: 'apr_existing',
      userId: 'usr_marco',
      userName: 'Marco',
      decision: 'approved',
    },
    { id: 'apr_me', userId: 'usr_ada', userName: 'Ada', decision: 'pending' },
  ],
  expiresAt: '2026-08-01T00:00:00.000Z',
  createdAt: '2026-07-31T00:00:00.000Z',
};

test('only owner, admin and finance roles can review', () => {
  assert.equal(canReviewProposal('owner'), true);
  assert.equal(canReviewProposal('admin'), true);
  assert.equal(canReviewProposal('finance'), true);
  assert.equal(canReviewProposal('developer'), false);
  assert.equal(canReviewProposal('auditor'), false);
  assert.equal(canReviewProposal('viewer'), false);
});

test('approving meets quorum and marks the proposal approved', () => {
  const snapshot = snapshotFromProposal(proposal);
  const next = applyDecision(snapshot, {
    decision: 'approved',
    reviewer: { id: 'usr_ada', name: 'Ada Okonkwo' },
    decidedAt: '2026-07-31T01:00:00.000Z',
  });

  assert.equal(next.status, 'approved');
  assert.equal(next.updatedAt, '2026-07-31T01:00:00.000Z');
  assert.equal(approvalProgress(next).approved, 2);
  assert.equal(approvalProgress(next).quorumMet, true);
});

test('changing an existing decision replaces it without double-counting', () => {
  const snapshot = snapshotFromProposal(proposal);
  const approved = applyDecision(snapshot, {
    decision: 'approved',
    reviewer: { id: 'usr_ada', name: 'Ada Okonkwo' },
    decidedAt: '2026-07-31T01:00:00.000Z',
  });
  const rejected = applyDecision(approved, {
    decision: 'rejected',
    reviewer: { id: 'usr_ada', name: 'Ada Okonkwo' },
    comment: 'Budget changed.',
    decidedAt: '2026-07-31T02:00:00.000Z',
  });

  const mine = rejected.approvals.filter((entry) => entry.userId === 'usr_ada');
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.decision, 'rejected');
  assert.equal(mine[0]?.comment, 'Budget changed.');
  assert.equal(approvalProgress(rejected).approved, 1);
  assert.equal(approvalProgress(rejected).rejected, 1);
  assert.equal(rejected.status, 'pending');
});

test('rejecting does not close a proposal that still has other reviewers', () => {
  const snapshot = snapshotFromProposal(proposal);
  const next = applyDecision(snapshot, {
    decision: 'rejected',
    reviewer: { id: 'usr_ada', name: 'Ada Okonkwo' },
  });

  assert.equal(next.status, 'pending');
  assert.equal(approvalProgress(next).remaining, 1);
});

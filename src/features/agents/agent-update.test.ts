import assert from 'node:assert/strict';
import test from 'node:test';

import type { Agent } from '@/types/domain';
import {
  applyAgentUpdate,
  applyAgentListUpdate,
  resolveAgentUpdateId,
  extractAgentUpdates,
} from './agent-update';

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    organizationId: 'org-1',
    name: 'Treasury Agent',
    description: 'Handles treasury operations.',
    role: 'finance',
    status: 'active',
    mode: 'assisted',
    provider: 'OpenAI',
    model: 'gpt-4o',
    capabilities: ['wallet.read'],
    monthlyBudget: 1000,
    budgetSpent: 100,
    policyIds: [],
    lastActiveAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('applyAgentUpdate patches the cached agent without mutating the original', () => {
  const original = agent();
  const updated = applyAgentUpdate(original, { timeoutSeconds: 120, maxSpendPerTransaction: 50 });

  assert.equal(updated.id, original.id);
  assert.equal((updated as Record<string, unknown>).timeoutSeconds, 120);
  assert.equal((updated as Record<string, unknown>).maxSpendPerTransaction, 50);
  // original untouched
  assert.equal((original as Record<string, unknown>).timeoutSeconds, undefined);
});

test('applyAgentListUpdate updates only the matching agent', () => {
  const a = agent({ id: 'agent-1' });
  const b = agent({ id: 'agent-2', name: 'Other' });
  const list = [a, b];

  const next = applyAgentListUpdate(list, 'agent-1', { timeoutSeconds: 90 });

  assert.ok(next);
  assert.equal(next!.length, 2);
  assert.equal((next![0] as Record<string, unknown>).timeoutSeconds, 90);
  assert.equal((next![1] as Record<string, unknown>).timeoutSeconds, undefined);
  // original list untouched
  assert.equal((list[0] as Record<string, unknown>).timeoutSeconds, undefined);
});

test('applyAgentListUpdate returns undefined for missing cache', () => {
  assert.equal(applyAgentListUpdate(undefined, 'agent-1', { timeoutSeconds: 90 }), undefined);
});

test('resolveAgentUpdateId prefers explicit id fields', () => {
  assert.equal(resolveAgentUpdateId({ id: 'a1' }), 'a1');
  assert.equal(resolveAgentUpdateId({ agentId: 'a2' }), 'a2');
  assert.equal(resolveAgentUpdateId({ timeoutSeconds: 5 }, 'fallback'), 'fallback');
});

test('extractAgentUpdates strips routing fields', () => {
  const updates = extractAgentUpdates({ id: 'a1', agentId: 'a1', timeoutSeconds: 60, maxSpendPerTransaction: 25 });
  assert.deepEqual(updates, { timeoutSeconds: 60, maxSpendPerTransaction: 25 });
});
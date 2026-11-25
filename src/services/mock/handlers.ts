import type { ApiMeta, ListQuery } from '@/types/api';
import type { PolicySimulationResult } from '@/types/domain';
import { AstroidApiError } from '@/services/errors';
import { shouldSimulateMockFailure, simulateMockLatency } from './config';
import { paginate } from './pagination';
import {
  agents,
  budgets,
  currentUser,
  organizations,
  policies,
  teamMembers,
  wallets,
} from './entities';
import { proposals, transactions } from './transactions';
import { memoryRecords, notifications } from './memory';
import {
  activityData,
  aiBriefing,
  analyticsOverview,
  apiKeys,
  assistantSeed,
  webhooks,
} from './analytics';
import { assetRates } from './rates';
import { MOCK_AUDIT_EVENTS } from './audit';

/**
 * Mock API handler registry.
 *
 * `API client `request` calls route here whenever `NEXT_PUBLIC_API_URL` is
 * unset, so every method on `apiClient` switches transparently between the
 * live REST API and this offline transport. Responses use the exact
 * `{ data, meta }` envelope of the live API and go through the same
 * `AstroidApiError` surface, including realistic 404s and validation errors.
 *
 * Simulated latency (and opt-in transient failures) are applied before the
 * route resolves, so TanStack Query exercises real loading/error states.
 */

export type MockRequestInit = RequestInit & { query?: ListQuery };

type MockResult = { data: unknown; meta: ApiMeta };

function ok<T>(data: T, meta: ApiMeta = {}): { data: T; meta: ApiMeta } {
  return { data, meta };
}

/** Paginate a fixture collection using the shared list-query semantics. */
function list<T>(items: T[], query?: ListQuery): { data: T[]; meta: ApiMeta } {
  const { items: page, meta } = paginate(items, query);
  return ok(page, meta);
}

function findOrThrow<T extends { id: string }>(items: T[], id: string, entity: string): T {
  const found = items.find((item) => item.id === decodeURIComponent(id));
  if (!found) {
    throw new AstroidApiError('NOT_FOUND', `${entity} "${id}" was not found.`);
  }
  return found;
}

/** Parse a JSON request body; malformed payloads are rejected like the live API. */
function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string' || body.trim().length === 0) return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AstroidApiError('VALIDATION_ERROR', 'Request body must be valid JSON.');
  }
}

/** Derive the deterministic policy-simulation result used across environments. */
function simulatePolicy(body: unknown): PolicySimulationResult {
  const amount = (body as { amount?: unknown } | undefined)?.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new AstroidApiError(
      'VALIDATION_ERROR',
      'A positive numeric "amount" is required to simulate a policy.',
    );
  }

  const requiresApproval = amount >= 5_000;
  const blocked = amount > 25_000;
  const risk = Math.min(98, Math.round(6 + (amount / 25_000) * 60));

  return {
    passed: !blocked,
    triggeredPolicies: [
      { policyId: 'pol_max_txn', name: 'Maximum transaction ceiling', passed: !blocked },
      {
        policyId: 'pol_approval_5k',
        name: 'Dual approval above 5,000',
        passed: !requiresApproval,
      },
    ],
    requiredApprovals: blocked ? 3 : requiresApproval ? 2 : 0,
    estimatedRisk: risk,
    budgetImpact: {
      budgetId: 'bud_eng',
      name: 'Engineering',
      remainingAfter: Math.max(0, 41_400 - amount),
    },
    predictedOutcome: blocked ? 'blocked' : requiresApproval ? 'requires_approval' : 'auto_execute',
  };
}

/** Match a path against a single-segment id pattern, returning the decoded id. */
function matchId(path: string, prefix: string, suffix = ''): string | null {
  const pattern = new RegExp(`^${prefix}/([^/]+)${suffix}$`);
  const match = pattern.exec(path)?.[1];
  return match ? decodeURIComponent(match) : null;
}

/** Resolve `/wallets/:id`-style nested routes; returns null when nothing matches. */
function dispatchNested(path: string): MockResult | null {
  if (path.startsWith('/wallets/')) {
    const balanceId = matchId(path, '/wallets', '/balances');
    if (balanceId) return ok(findOrThrow(wallets, balanceId, 'Wallet').balances);
    const walletId = matchId(path, '/wallets');
    if (walletId) return ok(findOrThrow(wallets, walletId, 'Wallet'));
  }

  const agentId = matchId(path, '/agents');
  if (agentId) return ok(findOrThrow(agents, agentId, 'Agent'));

  const policyId = matchId(path, '/policies');
  if (policyId) return ok(findOrThrow(policies, policyId, 'Policy'));

  const budgetId = matchId(path, '/budgets');
  if (budgetId) return ok(findOrThrow(budgets, budgetId, 'Budget'));

  const transactionId = matchId(path, '/transactions');
  if (transactionId) return ok(findOrThrow(transactions, transactionId, 'Transaction'));

  const proposalId = matchId(path, '/proposals');
  if (proposalId) return ok(findOrThrow(proposals, proposalId, 'Proposal'));

  const memoryRecordId = matchId(path, '/memory');
  if (memoryRecordId) return ok(findOrThrow(memoryRecords, memoryRecordId, 'Memory record'));

  const auditEventId = matchId(path, '/audit/logs');
  if (auditEventId) {
    const event = MOCK_AUDIT_EVENTS.find((item) => item.id === auditEventId);
    if (!event) {
      throw new AstroidApiError('NOT_FOUND', `Audit event "${auditEventId}" was not found.`);
    }
    return ok(event);
  }

  return null;
}

const GET_COLLECTIONS: Record<string, unknown[]> = {
  '/organizations': organizations,
  '/team': teamMembers,
  '/analytics/activity': activityData,
  '/wallets': wallets,
  '/agents': agents,
  '/policies': policies,
  '/budgets': budgets,
  '/transactions': transactions,
  '/proposals': proposals,
  '/memory': memoryRecords,
  '/audit/logs': MOCK_AUDIT_EVENTS,
  '/rates': assetRates,
  '/notifications': notifications,
  '/developer/keys': apiKeys,
  '/developer/webhooks': webhooks,
};

const GET_SINGLETONS: Record<string, unknown> = {
  '/auth/session': currentUser,
  '/analytics/overview': analyticsOverview,
  '/ai/briefing': aiBriefing,
  '/ai/assistant/seed': assistantSeed,
};

function dispatch(method: string, path: string, query: ListQuery | undefined, body: unknown): MockResult {
  if (method === 'GET') {
    const singleton = GET_SINGLETONS[path];
    if (singleton !== undefined) return ok(singleton);

    const collection = GET_COLLECTIONS[path];
    if (collection !== undefined) return list(collection, query);

    const nested = dispatchNested(path);
    if (nested) return nested;
  }

  if (method === 'POST' && path === '/policies/simulate') {
    return ok(simulatePolicy(body));
  }

  throw new AstroidApiError(
    'NOT_FOUND',
    `No mock handler is registered for ${method} ${path}.`,
  );
}

/**
 * Resolve a request against the mock registry.
 *
 * Applies the configured simulated latency first (so UI skeletons always get a
 * chance to render), then — when enabled — a probabilistic transient failure,
 * and finally dispatches to a typed fixture response.
 */
export async function resolveMockRequest<T>(
  path: string,
  init: MockRequestInit = {},
): Promise<{ data: T; meta: ApiMeta }> {
  const method = (init.method ?? 'GET').toUpperCase();

  await simulateMockLatency();

  if (shouldSimulateMockFailure()) {
    throw new AstroidApiError(
      'NETWORK_ERROR',
      `Simulated network failure for ${method} ${path} (NEXT_PUBLIC_MOCK_FAILURE_RATE).`,
    );
  }

  const normalized = path.split('?')[0]?.replace(/\/+$/, '') ?? path;
  const cleanPath = normalized.length === 0 ? '/' : normalized;

  return dispatch(method, cleanPath, init.query, parseBody(init.body)) as { data: T; meta: ApiMeta };
}

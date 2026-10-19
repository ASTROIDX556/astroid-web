import { isMockMode } from '@/lib/env';
import { apiClient } from '@/services/client';
import * as mock from '@/services/mock';
import {
  ApprovalGuardError,
  applyApprovalDecision,
  checkApprovalGuard,
  type ApprovalActor,
  type LocalApprovalDecision,
} from '@/features/approvals/approval-state';
import type {
  ActivityPoint,
  Agent,
  AiBriefing,
  AnalyticsOverview,
  ApiKey,
  AppNotification,
  AssetBalance,
  AssetRate,
  Budget,
  ChatMessage,
  MemoryRecord,
  Organization,
  Policy,
  PolicySimulationResult,
  Proposal,
  Transaction,
  User,
  Wallet,
  Webhook,
} from '@/types/domain';

/**
 * Resource layer.
 *
 * Every screen calls these functions through TanStack Query hooks. In mock mode
 * they resolve local fixtures behind a small simulated latency so loading and
 * skeleton states are exercised. When `NEXT_PUBLIC_API_URL` is set the layer
 * calls the live REST API via the typed client and unwraps its `data` envelope —
 * the UI is agnostic to which path is active.
 */

const LATENCY_MS = 320;

async function resolveLazy<T>(mockValue: () => T, live: () => Promise<T>): Promise<T> {
  if (isMockMode) {
    return new Promise((r) => setTimeout(() => r(mockValue()), LATENCY_MS));
  }
  try {
    const data = await live();
    if (data !== undefined && data !== null) {
      return data;
    }
    return mockValue();
  } catch (err) {
    console.warn(
      '[Astroid API] Live request failed, falling back to local dataset:',
      err,
    );
    return mockValue();
  }
}

function resolve<T>(mockValue: T, live: () => Promise<T>): Promise<T> {
  return resolveLazy(() => mockValue, live);
}

function notFound(entity: string): never {
  throw new Error(`${entity} not found`);
}

/** Fetch a collection in live mode. */
function list<T>(path: string): Promise<T> {
  return apiClient.request<T>(path).then((r) => r.data);
}

/** Fetch a single entity in live mode. */
function one<T>(path: string): Promise<T> {
  return apiClient.request<T>(path).then((r) => r.data);
}

/** Fire a side-effecting action in live mode (POST/SIMULATE etc.). */
function action<T>(path: string, body: unknown = {}): Promise<T> {
  return apiClient
    .request<T>(path, { method: 'POST', body: JSON.stringify(body) })
    .then((r) => r.data);
}

export interface RecordProposalDecisionInput {
  proposalId: string;
  decision: LocalApprovalDecision;
  actor: ApprovalActor;
  comment?: string;
}

export const resources = {
  // -- session / org ------------------------------------------------------
  getCurrentUser: (): Promise<User> =>
    resolve(mock.currentUser, () => one<User>('/auth/session')),
  getOrganizations: (): Promise<Organization[]> =>
    resolve(mock.organizations, () => list<Organization[]>('/organizations')),
  getTeam: (): Promise<User[]> =>
    resolve(mock.teamMembers, () => list<User[]>('/team')),

  // -- analytics ----------------------------------------------------------
  getOverview: (): Promise<AnalyticsOverview> =>
    resolve(mock.analyticsOverview, () =>
      one<AnalyticsOverview>('/analytics/overview'),
    ),
  getActivity: (): Promise<ActivityPoint[]> =>
    resolve(mock.activityData, () => list<ActivityPoint[]>('/analytics/activity')),

  // -- ai assistant -------------------------------------------------------
  getBriefing: (): Promise<AiBriefing> =>
    resolve(mock.aiBriefing, () => one<AiBriefing>('/ai/briefing')),
  getAssistantSeed: (): Promise<ChatMessage[]> =>
    resolve(mock.assistantSeed, () => one<ChatMessage[]>('/ai/assistant/seed')),

  // -- wallets ------------------------------------------------------------
  getWallets: (): Promise<Wallet[]> =>
    resolve(mock.wallets, () => list<Wallet[]>('/wallets')),
  getWallet: (id: string): Promise<Wallet> =>
    resolve(mock.wallets.find((w) => w.id === id) ?? notFound('Wallet'), () =>
      one<Wallet>(`/wallets/${id}`),
    ),
  getWalletBalances: (id: string): Promise<AssetBalance[]> =>
    resolve(
      mock.wallets.find((w) => w.id === id)?.balances ?? notFound('Balances'),
      () => one<AssetBalance[]>(`/wallets/${id}/balances`),
    ),

  // -- agents -------------------------------------------------------------
  getAgents: (): Promise<Agent[]> =>
    resolve(mock.agents, () => list<Agent[]>('/agents')),
  getAgent: (id: string): Promise<Agent> =>
    resolve(mock.agents.find((a) => a.id === id) ?? notFound('Agent'), () =>
      one<Agent>(`/agents/${id}`),
    ),

  // -- policies -----------------------------------------------------------
  getPolicies: (): Promise<Policy[]> =>
    resolve(mock.policies, () => list<Policy[]>('/policies')),
  getPolicy: (id: string): Promise<Policy> =>
    resolve(mock.policies.find((p) => p.id === id) ?? notFound('Policy'), () =>
      one<Policy>(`/policies/${id}`),
    ),
  simulatePolicy: (amount: number): Promise<PolicySimulationResult> =>
    resolve(
      (() => {
        const requiresApproval = amount >= 5_000;
        const blocked = amount > 25_000;
        const risk = Math.min(98, Math.round(6 + (amount / 25_000) * 60));
        return {
          passed: !blocked,
          triggeredPolicies: [
            {
              policyId: 'pol_max_txn',
              name: 'Maximum transaction ceiling',
              passed: !blocked,
            },
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
          predictedOutcome: blocked
            ? 'blocked'
            : requiresApproval
              ? 'requires_approval'
              : 'auto_execute',
        } satisfies PolicySimulationResult;
      })(),
      () => action<PolicySimulationResult>('/policies/simulate', { amount }),
    ),

  // -- budgets ------------------------------------------------------------
  getBudgets: (): Promise<Budget[]> =>
    resolve(mock.budgets, () => list<Budget[]>('/budgets')),
  getBudget: (id: string): Promise<Budget> =>
    resolve(mock.budgets.find((b) => b.id === id) ?? notFound('Budget'), () =>
      one<Budget>(`/budgets/${id}`),
    ),

  // -- transactions -------------------------------------------------------
  getTransactions: (): Promise<Transaction[]> =>
    resolve(mock.transactions, () => list<Transaction[]>('/transactions')),
  getTransaction: (id: string): Promise<Transaction> =>
    resolve(mock.transactions.find((t) => t.id === id) ?? notFound('Transaction'), () =>
      one<Transaction>(`/transactions/${id}`),
    ),

  // -- proposals / approvals ---------------------------------------------
  getProposals: (): Promise<Proposal[]> =>
    resolve(mock.proposals, () => list<Proposal[]>('/proposals')),
  getProposal: (id: string): Promise<Proposal> =>
    resolve(mock.proposals.find((p) => p.id === id) ?? notFound('Proposal'), () =>
      one<Proposal>(`/proposals/${id}`),
    ),
  /**
   * Record this actor's approve/reject decision. In mock mode the fixture is
   * validated against the approval guards and updated in place so a refetch
   * after invalidation observes the decision; live mode POSTs the decision.
   */
  recordProposalDecision: (input: RecordProposalDecisionInput): Promise<Proposal> =>
    resolveLazy(
      () => {
        const proposal =
          mock.proposals.find((p) => p.id === input.proposalId) ?? notFound('Proposal');
        const guard = checkApprovalGuard(proposal, input.actor.id);
        if (!guard.ok) {
          throw new ApprovalGuardError(guard.code, guard.message);
        }
        const updated = applyApprovalDecision(proposal, input.actor, input.decision, {
          comment: input.comment,
          actorName: input.actor.name,
        });
        Object.assign(proposal, updated);
        return updated;
      },
      () =>
        action<Proposal>(`/proposals/${input.proposalId}/decisions`, {
          decision: input.decision,
          comment: input.comment,
          actor: input.actor,
        }),
    ),

  // -- financial memory ---------------------------------------------------
  getMemoryRecords: (): Promise<MemoryRecord[]> =>
    resolve(mock.memoryRecords, () => list<MemoryRecord[]>('/memory')),
  getMemoryRecord: (id: string): Promise<MemoryRecord> =>
    resolve(
      mock.memoryRecords.find((m) => m.id === id) ?? notFound('Memory record'),
      () => one<MemoryRecord>(`/memory/${id}`),
    ),

  // -- asset rates ---------------------------------------------------------
  getAssetRates: (): Promise<AssetRate[]> =>
    resolve(mock.assetRates, () => list<AssetRate[]>('/rates')),

  // -- notifications ------------------------------------------------------
  getNotifications: (): Promise<AppNotification[]> =>
    resolve(mock.notifications, () => list<AppNotification[]>('/notifications')),

  // -- developer ----------------------------------------------------------
  getApiKeys: (): Promise<ApiKey[]> =>
    resolve(mock.apiKeys, () => list<ApiKey[]>('/developer/keys')),
  getWebhooks: (): Promise<Webhook[]> =>
    resolve(mock.webhooks, () => list<Webhook[]>('/developer/webhooks')),
};

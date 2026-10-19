import { isMockMode } from '@/lib/env';
import { apiClient, type ApiRequestInit, type ApiResult } from '@/services/client';
import { resolveMockRequest } from '@/services/mock/handlers';
import type { ListQuery } from '@/types/api';
import type { AuditEvent } from '@/types/audit';
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
 * Every screen calls these functions through TanStack Query hooks. Requests go
 * through the typed API client, which switches transport automatically:
 * in mock mode (`NEXT_PUBLIC_API_URL` unset) the local handler registry in
 * `services/mock/handlers` resolves them — with simulated latency — and in
 * live mode the real REST API is called. If a live request fails, the resource
 * layer degrades gracefully to the local dataset instead of breaking the UI.
 *
 * Collection endpoints accept an optional `ListQuery` (page/limit/search/sort/
 * filter) mirroring the live API; use {@link fetchResourcePage} when the
 * pagination envelope meta (total/totalPages) is needed.
 */

async function request<T>(path: string, init: ApiRequestInit = {}): Promise<ApiResult<T>> {
  try {
    return await apiClient.request<T>(path, init);
  } catch (err) {
    // In mock mode the handler registry *is* the transport: rethrow so 404s and
    // simulated transient failures surface to TanStack Query exactly once.
    if (isMockMode) throw err;

    console.warn('[Astroid API] Live request failed, falling back to local dataset:', err);
    return resolveMockRequest<T>(path, init);
  }
}

/** Resolve a path to its typed payload. */
async function data<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const result = await request<T>(path, init);
  return result.data;
}

/**
 * Fetch a collection page while keeping the pagination envelope meta
 * (`page`, `limit`, `total`, `totalPages`) for paginated views.
 */
export function fetchResourcePage<T>(path: string, query?: ListQuery): Promise<ApiResult<T>> {
  return request<T>(path, { query });
}

export const resources = {
  // -- session / org ------------------------------------------------------
  getCurrentUser: (): Promise<User> => data<User>('/auth/session'),
  getOrganizations: (query?: ListQuery): Promise<Organization[]> =>
    data<Organization[]>('/organizations', { query }),
  getTeam: (query?: ListQuery): Promise<User[]> => data<User[]>('/team', { query }),

  // -- analytics ----------------------------------------------------------
  getOverview: (): Promise<AnalyticsOverview> => data<AnalyticsOverview>('/analytics/overview'),
  getActivity: (query?: ListQuery): Promise<ActivityPoint[]> =>
    data<ActivityPoint[]>('/analytics/activity', { query }),

  // -- ai assistant -------------------------------------------------------
  getBriefing: (): Promise<AiBriefing> => data<AiBriefing>('/ai/briefing'),
  getAssistantSeed: (): Promise<ChatMessage[]> => data<ChatMessage[]>('/ai/assistant/seed'),

  // -- wallets ------------------------------------------------------------
  getWallets: (query?: ListQuery): Promise<Wallet[]> => data<Wallet[]>('/wallets', { query }),
  getWallet: (id: string): Promise<Wallet> =>
    data<Wallet>(`/wallets/${encodeURIComponent(id)}`),
  getWalletBalances: (id: string): Promise<AssetBalance[]> =>
    data<AssetBalance[]>(`/wallets/${encodeURIComponent(id)}/balances`),

  // -- agents -------------------------------------------------------------
  getAgents: (query?: ListQuery): Promise<Agent[]> => data<Agent[]>('/agents', { query }),
  getAgent: (id: string): Promise<Agent> => data<Agent>(`/agents/${encodeURIComponent(id)}`),

  // -- policies -----------------------------------------------------------
  getPolicies: (query?: ListQuery): Promise<Policy[]> => data<Policy[]>('/policies', { query }),
  getPolicy: (id: string): Promise<Policy> => data<Policy>(`/policies/${encodeURIComponent(id)}`),
  simulatePolicy: (amount: number): Promise<PolicySimulationResult> =>
    data<PolicySimulationResult>('/policies/simulate', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  // -- budgets ------------------------------------------------------------
  getBudgets: (query?: ListQuery): Promise<Budget[]> => data<Budget[]>('/budgets', { query }),
  getBudget: (id: string): Promise<Budget> => data<Budget>(`/budgets/${encodeURIComponent(id)}`),

  // -- transactions -------------------------------------------------------
  getTransactions: (query?: ListQuery): Promise<Transaction[]> =>
    data<Transaction[]>('/transactions', { query }),
  getTransaction: (id: string): Promise<Transaction> =>
    data<Transaction>(`/transactions/${encodeURIComponent(id)}`),

  // -- proposals / approvals ---------------------------------------------
  getProposals: (query?: ListQuery): Promise<Proposal[]> =>
    data<Proposal[]>('/proposals', { query }),
  getProposal: (id: string): Promise<Proposal> =>
    data<Proposal>(`/proposals/${encodeURIComponent(id)}`),

  // -- financial memory ---------------------------------------------------
  getMemoryRecords: (query?: ListQuery): Promise<MemoryRecord[]> =>
    data<MemoryRecord[]>('/memory', { query }),
  getMemoryRecord: (id: string): Promise<MemoryRecord> =>
    data<MemoryRecord>(`/memory/${encodeURIComponent(id)}`),

  // -- audit log ----------------------------------------------------------
  getAuditEvents: (query?: ListQuery): Promise<AuditEvent[]> =>
    data<AuditEvent[]>('/audit/logs', { query }),

  // -- asset rates ---------------------------------------------------------
  getAssetRates: (query?: ListQuery): Promise<AssetRate[]> =>
    data<AssetRate[]>('/rates', { query }),

  // -- notifications ------------------------------------------------------
  getNotifications: (query?: ListQuery): Promise<AppNotification[]> =>
    data<AppNotification[]>('/notifications', { query }),

  // -- developer ----------------------------------------------------------
  getApiKeys: (query?: ListQuery): Promise<ApiKey[]> =>
    data<ApiKey[]>('/developer/keys', { query }),
  getWebhooks: (query?: ListQuery): Promise<Webhook[]> =>
    data<Webhook[]>('/developer/webhooks', { query }),
};

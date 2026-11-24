'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  AGENT_STATUS_REFETCH_INTERVAL_MS,
  AGENT_STATUS_STALE_TIME_MS,
  ASSET_RATE_REFETCH_INTERVAL_MS,
  ASSET_RATE_STALE_TIME_MS,
  WALLET_BALANCE_REFETCH_INTERVAL_MS,
  WALLET_BALANCE_STALE_TIME_MS,
} from '@/lib/query-config';
import { queryKeys } from '@/services/query-keys';
import { resources, type AgentConfigPatch } from '@/services/resources';
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
 * Typed TanStack Query hooks over the resource layer.
 *
 * Every screen reads data through these hooks so the query keys stay
 * centralized and the mock/live swap in `resources` is transparent to the UI.
 */

// -- session / org ----------------------------------------------------------
export const useCurrentUser = (): UseQueryResult<User> =>
  useQuery({ queryKey: queryKeys.session, queryFn: resources.getCurrentUser });

export const useOrganizations = (): UseQueryResult<Organization[]> =>
  useQuery({ queryKey: queryKeys.organizations, queryFn: resources.getOrganizations });

export const useTeam = (): UseQueryResult<User[]> =>
  useQuery({ queryKey: queryKeys.team, queryFn: resources.getTeam });

// -- analytics --------------------------------------------------------------
export const useOverview = (): UseQueryResult<AnalyticsOverview> =>
  useQuery({ queryKey: queryKeys.overview, queryFn: resources.getOverview });

export const useActivity = (): UseQueryResult<ActivityPoint[]> =>
  useQuery({ queryKey: queryKeys.activity, queryFn: resources.getActivity });

// -- ai assistant -----------------------------------------------------------
export const useBriefing = (): UseQueryResult<AiBriefing> =>
  useQuery({ queryKey: queryKeys.briefing, queryFn: resources.getBriefing });

export const useAssistantSeed = (): UseQueryResult<ChatMessage[]> =>
  useQuery({ queryKey: queryKeys.assistantSeed, queryFn: resources.getAssistantSeed });

// -- wallets ----------------------------------------------------------------
export const useWallets = (): UseQueryResult<Wallet[]> =>
  useQuery({ queryKey: queryKeys.wallets, queryFn: resources.getWallets });

export const useWallet = (id: string): UseQueryResult<Wallet> =>
  useQuery({
    queryKey: queryKeys.wallet(id),
    queryFn: () => resources.getWallet(id),
    enabled: Boolean(id),
  });

/** Asset-level balances, fetched separately so the cards own their loading/error state. */
export const useWalletBalances = (id: string): UseQueryResult<AssetBalance[]> =>
  useQuery({
    queryKey: queryKeys.walletBalances(id),
    queryFn: () => resources.getWalletBalances(id),
    enabled: Boolean(id),
    staleTime: WALLET_BALANCE_STALE_TIME_MS,
    refetchInterval: WALLET_BALANCE_REFETCH_INTERVAL_MS,
  });

// -- agents -----------------------------------------------------------------
export const useAgents = (): UseQueryResult<Agent[]> =>
  useQuery({
    queryKey: queryKeys.agents,
    queryFn: resources.getAgents,
    staleTime: AGENT_STATUS_STALE_TIME_MS,
    refetchInterval: AGENT_STATUS_REFETCH_INTERVAL_MS,
  });

export const useAgent = (id: string): UseQueryResult<Agent> =>
  useQuery({
    queryKey: queryKeys.agent(id),
    queryFn: () => resources.getAgent(id),
    enabled: Boolean(id),
    staleTime: AGENT_STATUS_STALE_TIME_MS,
    refetchInterval: AGENT_STATUS_REFETCH_INTERVAL_MS,
  });

// -- policies ---------------------------------------------------------------
export const usePolicies = (): UseQueryResult<Policy[]> =>
  useQuery({ queryKey: queryKeys.policies, queryFn: resources.getPolicies });

export const usePolicy = (id: string): UseQueryResult<Policy> =>
  useQuery({
    queryKey: queryKeys.policy(id),
    queryFn: () => resources.getPolicy(id),
    enabled: Boolean(id),
  });

/** Policy simulator — a mutation so it re-runs on demand with a fresh amount. */
export const usePolicySimulation = () =>
  useMutation<PolicySimulationResult, Error, number>({
    mutationFn: (amount: number) => resources.simulatePolicy(amount),
  });

// -- budgets ----------------------------------------------------------------
export const useBudgets = (): UseQueryResult<Budget[]> =>
  useQuery({ queryKey: queryKeys.budgets, queryFn: resources.getBudgets });

export const useBudget = (id: string): UseQueryResult<Budget> =>
  useQuery({
    queryKey: queryKeys.budget(id),
    queryFn: () => resources.getBudget(id),
    enabled: Boolean(id),
  });

// -- transactions -----------------------------------------------------------
export const useTransactions = (): UseQueryResult<Transaction[]> =>
  useQuery({ queryKey: queryKeys.transactions, queryFn: resources.getTransactions });

export const useTransaction = (id: string): UseQueryResult<Transaction> =>
  useQuery({
    queryKey: queryKeys.transaction(id),
    queryFn: () => resources.getTransaction(id),
    enabled: Boolean(id),
  });

// -- proposals / approvals --------------------------------------------------
export const useProposals = (): UseQueryResult<Proposal[]> =>
  useQuery({ queryKey: queryKeys.proposals, queryFn: resources.getProposals });

export const useProposal = (id: string): UseQueryResult<Proposal> =>
  useQuery({
    queryKey: queryKeys.proposal(id),
    queryFn: () => resources.getProposal(id),
    enabled: Boolean(id),
  });

// -- financial memory -------------------------------------------------------
export const useMemoryRecords = (): UseQueryResult<MemoryRecord[]> =>
  useQuery({ queryKey: queryKeys.memory, queryFn: resources.getMemoryRecords });

export const useMemoryRecord = (id: string): UseQueryResult<MemoryRecord> =>
  useQuery({
    queryKey: queryKeys.memoryRecord(id),
    queryFn: () => resources.getMemoryRecord(id),
    enabled: Boolean(id),
  });

// -- asset rates -------------------------------------------------------------
export const useAssetRates = (): UseQueryResult<AssetRate[]> =>
  useQuery({
    queryKey: queryKeys.rates,
    queryFn: resources.getAssetRates,
    staleTime: ASSET_RATE_STALE_TIME_MS,
    refetchInterval: ASSET_RATE_REFETCH_INTERVAL_MS,
  });

// -- notifications ----------------------------------------------------------
export const useNotifications = (): UseQueryResult<AppNotification[]> =>
  useQuery({ queryKey: queryKeys.notifications, queryFn: resources.getNotifications });

// -- developer --------------------------------------------------------------
export const useApiKeys = (): UseQueryResult<ApiKey[]> =>
  useQuery({ queryKey: queryKeys.apiKeys, queryFn: resources.getApiKeys });

export const useWebhooks = (): UseQueryResult<Webhook[]> =>
  useQuery({ queryKey: queryKeys.webhooks, queryFn: resources.getWebhooks });

// -- mutations --------------------------------------------------------------

/**
 * Persist an agent configuration change, then refresh every query whose data
 * derives from that agent: the detail cache is patched optimistically from the
 * response, while collections and activity are invalidated.
 */
export const useUpdateAgentConfig = () => {
  const queryClient = useQueryClient();

  return useMutation<Agent, Error, { id: string; patch: AgentConfigPatch }>({
    mutationFn: ({ id, patch }) => resources.updateAgent(id, patch),
    onSuccess: (agent) => {
      queryClient.setQueryData(queryKeys.agent(agent.id), agent);
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview });
    },
  });
};

/**
 * Submit a signed transaction and invalidate the ledgers it touches — the
 * transaction list, the source wallet and its balances, budgets, and the
 * dashboard overview — so no stale balance survives a successful submission.
 */
export const useSubmitTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, { xdr: string }>({
    mutationFn: ({ xdr }) => resources.submitTransaction(xdr),
    onSuccess: (transaction) => {
      queryClient.setQueryData(queryKeys.transaction(transaction.id), transaction);
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallets });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(transaction.walletId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.walletBalances(transaction.walletId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
};

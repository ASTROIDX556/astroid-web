'use client';

import { useQuery, useMutation, type UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-keys';
import { resources } from '@/services/resources';
import type {
  Agent,
  AiBriefing,
  AnalyticsOverview,
  ApiKey,
  AppNotification,
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

// -- agents -----------------------------------------------------------------
export const useAgents = (): UseQueryResult<Agent[]> =>
  useQuery({ queryKey: queryKeys.agents, queryFn: resources.getAgents });

export const useAgent = (id: string): UseQueryResult<Agent> =>
  useQuery({
    queryKey: queryKeys.agent(id),
    queryFn: () => resources.getAgent(id),
    enabled: Boolean(id),
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
    refetchInterval: 30_000,
  });

// -- notifications ----------------------------------------------------------
export const useNotifications = (): UseQueryResult<AppNotification[]> =>
  useQuery({ queryKey: queryKeys.notifications, queryFn: resources.getNotifications });

// -- developer --------------------------------------------------------------
export const useApiKeys = (): UseQueryResult<ApiKey[]> =>
  useQuery({ queryKey: queryKeys.apiKeys, queryFn: resources.getApiKeys });

export const useWebhooks = (): UseQueryResult<Webhook[]> =>
  useQuery({ queryKey: queryKeys.webhooks, queryFn: resources.getWebhooks });

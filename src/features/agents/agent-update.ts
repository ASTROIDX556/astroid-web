import type { Agent } from '@/types/domain';

/**
 * Shape of a partial agent configuration update. Mirrors `UpdateAgentInput` but
 * is intentionally loose so arbitrary agent parameters (execution timeout, max
 * spending limits, etc.) can flow through the optimistic cache patch.
 */
export type AgentUpdate = Record<string, unknown>;

/**
 * Apply a partial update to a single cached agent, returning a new object so
 * the previous snapshot stays intact for rollback.
 */
export function applyAgentUpdate<T extends { id: string }>(
  agent: T,
  updates: AgentUpdate,
): T {
  return { ...agent, ...updates } as T;
}

/**
 * Apply a partial update to the matching agent inside a cached list, returning
 * a new array (or the original reference when nothing changed) so rollback
 * snapshots remain immutable.
 */
export function applyAgentListUpdate<T extends { id: string }>(
  agents: T[] | undefined,
  id: string,
  updates: AgentUpdate,
): T[] | undefined {
  if (!agents) return agents;
  return agents.map((agent) =>
    agent.id === id ? ({ ...agent, ...updates } as T) : agent,
  );
}

/**
 * Resolve the target agent id from mutation variables, falling back to an
 * explicitly provided id.
 */
export function resolveAgentUpdateId(
  variables: { id?: string; agentId?: string } & AgentUpdate,
  fallback?: string,
): string | undefined {
  return (variables?.id ?? variables?.agentId ?? fallback) as string | undefined;
}

/**
 * Strip routing fields from mutation variables, leaving only the parameters
 * that should be applied to the cached agent.
 */
export function extractAgentUpdates(
  variables: { id?: string; agentId?: string } & AgentUpdate,
): AgentUpdate {
  const { id: _id, agentId: _agentId, ...updates } = variables ?? {};
  return updates;
}

// Re-export Agent for convenience.
export type { Agent };
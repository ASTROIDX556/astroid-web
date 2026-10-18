'use client';

import { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import type { Agent, AgentStatus } from '@/types/domain';

/** Search + provider + status state for the agent management list. */
export interface AgentFilterState {
  search: string;
  /** 'all' or one of the Agent provider unions. */
  provider: string;
  /** 'all' or one of the AgentStatus values. */
  status: string;
}

export const DEFAULT_AGENT_FILTERS: AgentFilterState = {
  search: '',
  provider: 'all',
  status: 'all',
};

const STATUS_OPTIONS: readonly AgentStatus[] = ['active', 'paused', 'suspended', 'archived'];

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

/**
 * Pure filter logic for the agent list: text search across agent names and IDs
 * plus exact-match provider and status filters. Kept as a standalone function
 * so it is trivially testable and usable from any table/grid renderer.
 */
export function filterAgents(agents: Agent[], filters: AgentFilterState): Agent[] {
  const term = filters.search.trim().toLowerCase();

  return agents.filter((agent) => {
    if (filters.provider !== 'all' && agent.provider !== filters.provider) return false;
    if (filters.status !== 'all' && agent.status !== filters.status) return false;
    if (
      term !== '' &&
      !agent.name.toLowerCase().includes(term) &&
      !agent.id.toLowerCase().includes(term)
    ) {
      return false;
    }
    return true;
  });
}

export interface AgentListFiltersProps {
  filters: AgentFilterState;
  onChange: (next: AgentFilterState) => void;
  /** Unfiltered agents — provider options are derived from the actual fleet. */
  agents: Agent[];
  /** Number of rows currently visible after filtering. */
  resultCount: number;
}

/**
 * Accessible toolbar for the agent management view: a search input (name/ID)
 * and provider + status filter dropdowns, with a clear action and a live
 * result count. Collapses to a single column on small screens.
 */
export function AgentListFilters({ filters, onChange, agents, resultCount }: AgentListFiltersProps) {
  const providers = useMemo(
    () => Array.from(new Set(agents.map((agent) => agent.provider))).sort(),
    [agents],
  );

  const isFiltered =
    filters.search.trim() !== '' || filters.provider !== 'all' || filters.status !== 'all';

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-end">
      <label className="flex min-w-0 flex-[2] flex-col gap-1.5 text-xs font-medium text-foreground">
        <span>Search agents</span>
        <Input
          type="search"
          placeholder="Filter by name or ID..."
          aria-label="Search agents by name or ID"
          leftIcon={<Search className="h-3.5 w-3.5" aria-hidden />}
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      </label>

      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-foreground">
        <span>Provider</span>
        <Select
          aria-label="Filter by AI provider"
          value={filters.provider}
          onChange={(event) => onChange({ ...filters, provider: event.target.value })}
        >
          <option value="all">All providers</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-foreground">
        <span>Status</span>
        <Select
          aria-label="Filter by operational status"
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value })}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {titleCase(status)}
            </option>
          ))}
        </Select>
      </label>

      {isFiltered && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start sm:self-auto sm:mb-0.5"
          leftIcon={<X className="h-3.5 w-3.5" aria-hidden />}
          onClick={() => onChange(DEFAULT_AGENT_FILTERS)}
        >
          Clear
        </Button>
      )}

      <p
        role="status"
        aria-live="polite"
        className="self-start text-2xs tabular text-foreground-secondary sm:mb-1 sm:self-auto sm:ml-auto"
      >
        {resultCount} of {agents.length} agents
      </p>
    </div>
  );
}

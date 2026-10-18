'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bot, Sparkles, Zap } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge, ProgressBar } from '@/components/dashboard/risk-badge';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { AgentClusterIllustration } from '@/components/illustrations';
import { useAgents } from '@/hooks/use-queries';
import { agentStatus } from '@/lib/status';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/format';
import { PageTransition } from '@/components/ui/motion';
import { AgentConfigForm } from '@/features/agents/AgentConfigForm';
import { AgentWizard } from '@/features/agents/AgentWizard';
import { AgentTemplateWizard } from '@/features/agents/components/AgentTemplateWizard';
import { AgentTimeline } from '@/features/agents/components/AgentTimeline';
import {
  AgentListFilters,
  DEFAULT_AGENT_FILTERS,
  filterAgents,
  type AgentFilterState,
} from '@/features/agents/components/AgentListFilters';

export default function AgentsPage() {
  const agents = useAgents();
  const [agentFilters, setAgentFilters] = useState<AgentFilterState>(DEFAULT_AGENT_FILTERS);

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Operate"
        title="Agents"
        description="Every autonomous operator, the budget it controls, and how close it is to its ceiling."
      />

      <ErrorBoundary section="Template wizard">
        <AgentTemplateWizard />
      </ErrorBoundary>
      <ErrorBoundary section="Agent wizard">
        <AgentWizard />
      </ErrorBoundary>
      <ErrorBoundary section="Agent activity timeline">
        <AgentTimeline />
      </ErrorBoundary>

      <QueryBoundary
        query={agents}
        loading={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            illustration={<AgentClusterIllustration />}
            title="No agents yet"
            description="Create your first agent to start delegating governed spend on Stellar."
          />
        }
      >
        {(data) => {
          const visibleAgents = filterAgents(data, agentFilters);

          return (
          <div className="space-y-6">
            <ErrorBoundary section="Agent configuration">
              <AgentConfigForm />
            </ErrorBoundary>

            <AgentListFilters
              filters={agentFilters}
              onChange={setAgentFilters}
              agents={data}
              resultCount={visibleAgents.length}
            />

            <SectionLabel>{visibleAgents.length} agents</SectionLabel>
            {visibleAgents.length === 0 ? (
              <EmptyState
                compact
                title="No agents match your filters"
                description="Try a different search term, or clear the provider and status filters."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAgentFilters(DEFAULT_AGENT_FILTERS)}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleAgents.map((agent) => {
                const status = agentStatus(agent.status);
                const utilization =
                  agent.monthlyBudget > 0
                    ? (agent.budgetSpent / agent.monthlyBudget) * 100
                    : 0;
                return (
                  <Link key={agent.id} href={`/agents/${agent.id}`} className="block">
                    <Card interactive className="h-full p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-gold-soft text-gold-strong">
                            <Bot className="h-5 w-5" aria-hidden />
                          </span>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">{agent.name}</p>
                            <p className="text-2xs capitalize text-foreground-secondary">
                              {agent.role} agent
                            </p>
                          </div>
                        </div>
                        <Badge variant={status.variant} size="sm" dot>
                          {status.label}
                        </Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" size="sm">
                          {agent.mode === 'autonomous' ? (
                            <Zap className="mr-1 h-3 w-3" aria-hidden />
                          ) : (
                            <Sparkles className="mr-1 h-3 w-3" aria-hidden />
                          )}
                          {agent.mode}
                        </Badge>
                        <Badge variant="neutral" size="sm">
                          {agent.provider} · {agent.model}
                        </Badge>
                        <RiskBadge score={riskFor(agent.budgetSpent, agent.monthlyBudget)} />
                      </div>

                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xs uppercase tracking-wide text-foreground-secondary">
                            Budget
                          </span>
                          <span className="tabular text-2xs text-foreground-secondary">
                            {formatCurrency(agent.budgetSpent, 'USDC', { compact: true })} /{' '}
                            {formatCurrency(agent.monthlyBudget, 'USDC', { compact: true })}
                          </span>
                        </div>
                        <ProgressBar value={utilization} label="Budget utilization" />
                      </div>

                      <p className="mt-4 text-2xs text-foreground-muted">
                        {formatNumber(agent.capabilities.length)} capabilities · active{' '}
                        {formatRelativeTime(agent.lastActiveAt)}
                      </p>
                    </Card>
                  </Link>
                );
              })}
            </div>
            )}
          </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

/** Derive a coarse risk score from how close the agent is to its ceiling. */
function riskFor(spent: number, budget: number): number {
  if (budget <= 0) return 10;
  return Math.round(Math.min(100, (spent / budget) * 100));
}

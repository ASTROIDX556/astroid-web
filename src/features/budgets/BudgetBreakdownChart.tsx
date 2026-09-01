'use client';

import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Layers, Receipt, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { getThresholdColor } from '@/features/budgets/BudgetAllocationChart';
import { MOCK_DEPARTMENT_BUDGETS } from './mock-data';
import type { AgentAllocation, DepartmentBudget } from './types';

export interface BudgetBreakdownChartProps {
  data?: DepartmentBudget[];
  title?: string;
  description?: string;
  className?: string;
}

/** A single treemap node, normalized from either a department or a sub-department (agent) row. */
interface BreakdownNode {
  id: string;
  name: string;
  allocated: number;
  consumed: number;
  asset: string;
  size: number;
  /** Present only for leaf (agent) nodes — drives the drill-down modal. */
  agent?: AgentAllocation;
}

function toNode(dept: DepartmentBudget): BreakdownNode {
  return {
    id: dept.id,
    name: dept.departmentName,
    allocated: dept.totalLimit,
    consumed: dept.totalSpent,
    asset: dept.asset,
    size: Math.max(dept.totalSpent, 1),
  };
}

function toAgentNode(agent: AgentAllocation, asset: string): BreakdownNode {
  return {
    id: agent.id,
    name: agent.agentName,
    allocated: agent.allocatedAmount,
    consumed: agent.spentAmount,
    asset,
    size: Math.max(agent.spentAmount, 1),
    agent,
  };
}

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: BreakdownNode;
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, payload }: TreemapContentProps) {
  if (!payload || width <= 0 || height <= 0) return null;
  const pct = payload.allocated > 0 ? (payload.consumed / payload.allocated) * 100 : 0;
  const { hex } = getThresholdColor(pct);
  const showLabel = width > 70 && height > 32;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: hex,
          fillOpacity: 0.85,
          stroke: 'rgb(var(--chart-surface))',
          strokeWidth: 2,
          cursor: 'pointer',
          transition: 'fill-opacity 0.15s ease-in-out',
        }}
      />
      {showLabel && (
        <>
          <text x={x + 8} y={y + 18} fontSize={11} fontWeight={600} fill="#ffffff">
            {payload.name.length > (width / 7) ? `${payload.name.slice(0, Math.max(1, Math.floor(width / 7) - 1))}…` : payload.name}
          </text>
          <text x={x + 8} y={y + 34} fontSize={10} fill="rgba(255,255,255,0.85)">
            {Math.round(pct)}% utilized
          </text>
        </>
      )}
    </g>
  );
}

function BreakdownTooltip({ active, payload }: { active?: boolean; payload?: { payload: BreakdownNode }[] }) {
  if (!active || !payload || !payload.length) return null;
  const node = payload[0]?.payload;
  if (!node) return null;

  const pct = node.allocated > 0 ? (node.consumed / node.allocated) * 100 : 0;
  const variance = node.allocated - node.consumed;
  const isOver = variance < 0;

  return (
    <div className="z-50 min-w-[200px] space-y-1.5 rounded-lg border border-border bg-surface-primary p-3 text-xs shadow-md">
      <p className="border-b border-border/60 pb-1 font-semibold text-foreground">{node.name}</p>
      <div className="flex justify-between gap-4">
        <span className="text-foreground-secondary">Consumed:</span>
        <span className="tabular font-medium text-foreground">{formatCurrency(node.consumed, node.asset)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-foreground-secondary">Allocated:</span>
        <span className="tabular font-medium text-foreground">{formatCurrency(node.allocated, node.asset)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-1">
        <span className="font-medium text-foreground-secondary">Variance:</span>
        <span className={`tabular font-bold ${isOver ? 'text-danger' : 'text-success'}`}>
          {isOver ? '−' : '+'}
          {formatCurrency(Math.abs(variance), node.asset)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-foreground-secondary">% Consumed:</span>
        <span className="tabular font-bold">{Math.round(pct)}%</span>
      </div>
      {node.agent && <p className="pt-1 text-2xs text-foreground-muted">Click to view ledger history</p>}
      {!node.agent && <p className="pt-1 text-2xs text-foreground-muted">Click to drill into sub-departments</p>}
    </div>
  );
}

/**
 * Hierarchical department → agent budget treemap with click-through
 * drill-down. Selecting a department zooms into its per-agent allocations;
 * selecting an agent opens a modal with its recent ledger history.
 */
export function BudgetBreakdownChart({
  data = MOCK_DEPARTMENT_BUDGETS,
  title = 'Department Budget Breakdown',
  description = 'Click a department to drill into agent-level allocations, then an agent to view its ledger history.',
  className = '',
}: BudgetBreakdownChartProps) {
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [ledgerAgent, setLedgerAgent] = useState<AgentAllocation | null>(null);

  const activeDept = useMemo(
    () => data.find((d) => d.id === activeDeptId) ?? null,
    [data, activeDeptId],
  );

  const nodes: BreakdownNode[] = useMemo(() => {
    if (!activeDept) return data.map(toNode);
    return activeDept.agents.map((a) => toAgentNode(a, activeDept.asset));
  }, [data, activeDept]);

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <EmptyState
            title="No department budgets"
            description="Once departments and agent allocations are configured, their spend breakdown will appear here."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="border-b border-border bg-surface-primary/60 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-gold" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </div>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>

          <AnimatePresence>
            {activeDept && (
              <motion.button
                type="button"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                onClick={() => setActiveDeptId(null)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                <span>All departments</span>
                <Badge variant="outline" size="sm">
                  {activeDept.departmentCode}
                </Badge>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeDeptId ?? 'root'}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="h-96 w-full"
            role="region"
            aria-label={activeDept ? `${activeDept.departmentName} agent breakdown` : 'Department budget breakdown'}
          >
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={nodes}
                dataKey="size"
                nameKey="name"
                stroke="rgb(var(--chart-surface))"
                content={<TreemapCell />}
                isAnimationActive={false}
                onClick={(node: unknown) => {
                  const payload = node as Partial<BreakdownNode> | undefined;
                  if (!payload?.id) return;
                  if (payload.agent) {
                    setLedgerAgent(payload.agent);
                  } else if (!activeDept) {
                    setActiveDeptId(payload.id);
                  }
                }}
              >
                <Tooltip content={<BreakdownTooltip />} />
              </Treemap>
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/60 pt-3 text-2xs text-foreground-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2A78D6]" />
            <span>Optimal (&lt;80%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#D98A21]" />
            <span>Warning (80%–99%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#C84747]" />
            <span>Over budget (&ge;100%)</span>
          </span>
        </div>
      </CardContent>

      <LedgerModal agent={ledgerAgent} onClose={() => setLedgerAgent(null)} />
    </Card>
  );
}

function LedgerModal({ agent, onClose }: { agent: AgentAllocation | null; onClose: () => void }) {
  const pct = agent && agent.allocatedAmount > 0 ? (agent.spentAmount / agent.allocatedAmount) * 100 : 0;
  const variance = agent ? agent.allocatedAmount - agent.spentAmount : 0;
  const isOver = variance < 0;

  return (
    <Dialog
      open={Boolean(agent)}
      onClose={onClose}
      title={agent?.agentName}
      description={agent ? `${agent.role} · Ledger history` : undefined}
      size="lg"
    >
      {agent && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-card border border-border p-3">
              <p className="text-2xs text-foreground-muted">Allocated</p>
              <p className="tabular text-sm font-semibold">{formatCurrency(agent.allocatedAmount, agent.asset, { compact: true })}</p>
            </div>
            <div className="rounded-card border border-border p-3">
              <p className="text-2xs text-foreground-muted">Consumed</p>
              <p className="tabular text-sm font-semibold">{formatCurrency(agent.spentAmount, agent.asset, { compact: true })}</p>
            </div>
            <div className="rounded-card border border-border p-3">
              <p className="text-2xs text-foreground-muted">Variance</p>
              <p className={`tabular flex items-center gap-1 text-sm font-semibold ${isOver ? 'text-danger' : 'text-success'}`}>
                {isOver ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {isOver ? '−' : '+'}
                {formatCurrency(Math.abs(variance), agent.asset, { compact: true })}
              </p>
            </div>
            <div className="rounded-card border border-border p-3">
              <p className="text-2xs text-foreground-muted">Utilization</p>
              <p className="tabular text-sm font-semibold">{Math.round(pct)}%</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-foreground-muted">
              <Receipt className="h-3.5 w-3.5" />
              <span>Recent ledger entries</span>
            </div>
            {agent.ledger && agent.ledger.length > 0 ? (
              <div className="overflow-x-auto rounded-card border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-surface-secondary text-foreground-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Counterparty</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {agent.ledger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-surface-secondary/40">
                        <td className="px-3 py-2.5 text-foreground-secondary">{formatDateTime(entry.date)}</td>
                        <td className="px-3 py-2.5 text-foreground">{entry.description}</td>
                        <td className="px-3 py-2.5 text-foreground-secondary">{entry.counterparty}</td>
                        <td className="px-3 py-2.5 text-right tabular font-medium text-foreground">
                          {formatCurrency(entry.amount, agent.asset)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                compact
                title="No ledger entries"
                description="This agent has no recorded ledger activity in the current period."
              />
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default BudgetBreakdownChart;

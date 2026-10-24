'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/dashboard/risk-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/format';
import { BudgetMeters, type BudgetMeterProps } from './BudgetMeters';
import { ExpenseBreakdownChart } from './ExpenseBreakdownChart';
import { MOCK_DEPARTMENT_BUDGETS } from './mock-data';
import {
  buildExpenseSeries,
  departmentAgentRows,
  toExpenseInputs,
} from './utils/expenseBreakdown';
import type { DepartmentBudget } from './types';

/**
 * Department-level budget meter drill-down (#247).
 *
 * Renders the department consumption meters with an interactive drill-down
 * trigger on each meter. Activating it expands (framer-motion) a panel with
 * the historical expense breakdown time series for that department plus a
 * per-agent spend rail, and collapses again from the panel header.
 */

function metersFromDepartments(departments: DepartmentBudget[]): BudgetMeterProps[] {
  return departments.map((dept) => ({
    label: dept.departmentName,
    allocated: dept.totalLimit,
    spent: dept.totalSpent,
    currency: dept.asset,
  }));
}

export interface BudgetMeterDrilldownSectionProps {
  departments?: DepartmentBudget[];
}

export function BudgetMeterDrilldownSection({
  departments = MOCK_DEPARTMENT_BUDGETS,
}: BudgetMeterDrilldownSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const meters = useMemo(() => metersFromDepartments(departments), [departments]);

  const selected = useMemo(
    () => departments.find((dept) => dept.departmentName === selectedId) ?? null,
    [departments, selectedId],
  );

  const series = useMemo(
    () => (selected ? buildExpenseSeries(toExpenseInputs(selected)) : []),
    [selected],
  );

  const agentRows = useMemo(
    () => (selected ? departmentAgentRows(selected) : []),
    [selected],
  );

  const handleDrillDown = (meter: BudgetMeterProps) => {
    setSelectedId((current) => (current === meter.label ? null : meter.label));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
            Department budget consumption
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold">Live envelope usage</h3>
        </div>
        <Badge variant="outline" size="sm">
          Drill-down ready
        </Badge>
      </div>

      <BudgetMeters budgets={meters} onDrillDown={handleDrillDown} />

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <Card className="border-border/80">
              <CardContent className="space-y-5 pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <ChevronDown className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                    <p className="truncate text-sm font-semibold text-foreground" title={selected.departmentName}>
                      {selected.departmentName}
                    </p>
                    <Badge variant="outline" size="sm">
                      {selected.departmentCode}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="inline-flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                    Close breakdown
                  </button>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <ExpenseBreakdownChart
                    bare
                    series={series}
                    asset={selected.asset}
                    subjectName={selected.departmentName}
                  />

                  <div className="min-w-0 space-y-3">
                    <p className="text-2xs font-semibold uppercase tracking-wider text-foreground-muted">
                      Agent spend
                    </p>
                    {agentRows.length === 0 ? (
                      <EmptyState
                        compact
                        title="No agents configured"
                        description="This department has no agent allocations in the current period."
                      />
                    ) : (
                      <ul className="space-y-3">
                        {agentRows.map((row) => {
                          const pct = row.allocated > 0 ? (row.spent / row.allocated) * 100 : 0;
                          return (
                            <li key={row.agentId} className="space-y-1.5">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-xs font-medium text-foreground" title={row.agentName}>
                                  {row.agentName}
                                </span>
                                <span className="shrink-0 tabular text-2xs text-foreground-secondary">
                                  {formatCurrency(row.spent, row.asset, { compact: true })} /{' '}
                                  {formatCurrency(row.allocated, row.asset, { compact: true })}
                                </span>
                              </div>
                              <ProgressBar value={pct} label={`${row.agentName} utilization`} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BudgetMeterDrilldownSection;

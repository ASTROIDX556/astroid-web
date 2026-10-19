'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import {
  AlertTriangle,
  ShieldAlert,
  BarChart3,
  Table as TableIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

export interface BudgetDepartmentData {
  id: string;
  department: string;
  allocated: number;
  consumed: number;
  currency?: string;
}

export interface BudgetAllocationChartProps {
  data?: BudgetDepartmentData[];
  title?: string;
  description?: string;
  className?: string;
  /** Renders a skeleton chart while utilization data is in flight. */
  isLoading?: boolean;
}

const DEFAULT_BUDGET_DATA: BudgetDepartmentData[] = [
  {
    id: '1',
    department: 'Treasury & Operations',
    allocated: 25000,
    consumed: 14500,
    currency: 'USDC',
  },
  {
    id: '2',
    department: 'Trading & Arbitrage',
    allocated: 40000,
    consumed: 34800,
    currency: 'USDC',
  },
  {
    id: '3',
    department: 'R&D AI Cluster',
    allocated: 15000,
    consumed: 16200,
    currency: 'USDC',
  },
  {
    id: '4',
    department: 'Marketing & Bounties',
    allocated: 10000,
    consumed: 4200,
    currency: 'USDC',
  },
  {
    id: '5',
    department: 'Security Audit Pool',
    allocated: 30000,
    consumed: 21000,
    currency: 'USDC',
  },
];

export type BudgetUtilizationStatus = 'normal' | 'warning' | 'danger';

/**
 * Maps a utilization percentage to the design-token color for its threshold
 * band. Returns CSS custom-property references (never raw hex) so the chart
 * follows the light/dark theme defined in `src/styles/tokens.css`.
 */
export function getThresholdColor(utilizationPercent: number): {
  color: string;
  status: BudgetUtilizationStatus;
} {
  if (!Number.isFinite(utilizationPercent) || utilizationPercent >= 100) {
    return { color: 'rgb(var(--danger))', status: 'danger' };
  }
  if (utilizationPercent >= 80) {
    return { color: 'rgb(var(--warning))', status: 'warning' };
  }
  return { color: 'rgb(var(--chart-1))', status: 'normal' };
}

/** Utilization as a percentage; guards zero/absent allocation. */
export function budgetUtilizationPercent(consumed: number, allocated: number): number {
  if (!Number.isFinite(consumed) || !Number.isFinite(allocated) || allocated <= 0) {
    return consumed > 0 ? Number.POSITIVE_INFINITY : 0;
  }
  return (consumed / allocated) * 100;
}

interface BudgetChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: BudgetDepartmentData }>;
}

const CustomTooltip = ({ active, payload }: BudgetChartTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const utilization = budgetUtilizationPercent(data.consumed, data.allocated);
  const remaining = Math.max(0, data.allocated - data.consumed);
  const currency = data.currency || 'USDC';
  const { status, color } = getThresholdColor(utilization);

  return (
    <div
      className="space-y-1.5 z-50 min-w-[200px] rounded-lg border border-border bg-surface-primary p-3 text-xs shadow-md"
      style={{ borderColor: status !== 'normal' ? color : undefined }}
    >
      <p className="border-b border-border/60 pb-1 font-semibold text-foreground">
        {data.department}
      </p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-foreground-secondary">Consumed:</span>
          <span className="tabular font-medium text-foreground">
            {formatCurrency(data.consumed, currency)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-foreground-secondary">Allocated Limit:</span>
          <span className="tabular font-medium text-foreground">
            {formatCurrency(data.allocated, currency)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-foreground-secondary">Remaining:</span>
          <span
            className={`tabular font-medium ${data.consumed > data.allocated ? 'text-danger' : 'text-success'}`}
          >
            {data.consumed > data.allocated ? '−' : ''}
            {formatCurrency(remaining, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-1">
          <span className="font-medium text-foreground-secondary">Utilization:</span>
          <span className="tabular font-bold" style={{ color }}>
            {Number.isFinite(utilization) ? `${Math.round(utilization)}%` : '∞'}
          </span>
        </div>
      </div>

      {status === 'warning' && (
        <div className="flex items-center gap-1 pt-1 text-2xs font-medium text-warning">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>Approaching Limit (≥80%)</span>
        </div>
      )}
      {status === 'danger' && (
        <div className="flex items-center gap-1 pt-1 text-2xs font-semibold text-danger">
          <ShieldAlert className="h-3 w-3 shrink-0" />
          <span>Budget Limit Exceeded!</span>
        </div>
      )}
    </div>
  );
};

export function BudgetAllocationChart({
  data = DEFAULT_BUDGET_DATA,
  title = 'Department Budget Allocation & Consumption',
  description = 'Real-time expenditure monitoring with automated 80% & 100% capacity threshold alerts.',
  className = '',
  isLoading = false,
}: BudgetAllocationChartProps) {
  const [showTableView, setShowTableView] = useState<boolean>(false);
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  const warnings = useMemo(
    () => data.filter((d) => budgetUtilizationPercent(d.consumed, d.allocated) >= 80),
    [data],
  );

  const currency = data[0]?.currency ?? 'USDC';
  const isEmpty = !isLoading && data.length === 0;

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="border-b border-border bg-surface-primary/60 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gold" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </div>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {warnings.length > 0 && (
              <Badge variant="warning" size="sm" className="font-medium">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {warnings.length} Threshold {warnings.length === 1 ? 'Alert' : 'Alerts'}
              </Badge>
            )}

            <button
              onClick={() => setShowTableView((prev) => !prev)}
              className="gap-1.5 px-2.5 py-1.5 inline-flex items-center rounded-md border border-border text-xs font-medium text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={
                showTableView
                  ? 'Switch to graphical chart view'
                  : 'Switch to accessible tabular view'
              }
            >
              {showTableView ? (
                <>
                  <BarChart3 className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                  <span>Chart View</span>
                </>
              ) : (
                <>
                  <TableIcon
                    className="h-3.5 w-3.5 text-foreground-secondary"
                    aria-hidden="true"
                  />
                  <span>Accessible Table</span>
                </>
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6" aria-busy={isLoading || undefined}>
        {isLoading ? (
          <div
            className="space-y-3 py-4"
            role="status"
            aria-label="Loading budget allocation chart"
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="w-32 h-3" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState
            compact
            title="No budget data yet"
            description="Department allocations and consumption will appear here once budgets are configured."
          />
        ) : !showTableView ? (
          <div className="space-y-4">
            <div
              className="h-80 w-full"
              role="region"
              aria-label="Budget Allocation Chart Graph"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                    stroke="rgb(var(--chart-grid))"
                    opacity={0.5}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(val: number) =>
                      formatCurrency(val, currency, { compact: true })
                    }
                    tick={{ fill: 'rgb(var(--text-muted))', fontSize: 11 }}
                    axisLine={{ stroke: 'rgb(var(--chart-axis))' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="department"
                    tick={{ fill: 'rgb(var(--text-secondary))', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={140}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    allowEscapeViewBox={{ x: false, y: false }}
                    cursor={{ fill: 'rgb(var(--surface-secondary))', opacity: 0.4 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(value) => (
                      <span className="font-medium text-foreground-secondary">
                        {value}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey="allocated"
                    name="Allocated Limit"
                    fill="rgb(var(--surface-secondary))"
                    radius={[0, 4, 4, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="consumed"
                    name="Consumed Balance"
                    radius={[0, 4, 4, 0]}
                    barSize={14}
                    onMouseEnter={(_, index) => setActiveBarIndex(index)}
                    onMouseLeave={() => setActiveBarIndex(null)}
                  >
                    {data.map((entry, index) => {
                      const pct = budgetUtilizationPercent(
                        entry.consumed,
                        entry.allocated,
                      );
                      const { color } = getThresholdColor(pct);
                      const isHovered = activeBarIndex === index;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          style={{
                            fill: color,
                            transition: 'all 0.2s ease-in-out',
                            filter: isHovered ? 'brightness(1.1)' : 'none',
                          }}
                          opacity={activeBarIndex === null || isHovered ? 1 : 0.6}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-2xs text-foreground-secondary">
              <div className="flex items-center gap-4">
                <span className="gap-1.5 flex items-center">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: 'rgb(var(--chart-1))' }}
                  />
                  <span>Optimal (&lt;80%)</span>
                </span>
                <span className="gap-1.5 flex items-center">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: 'rgb(var(--warning))' }}
                  />
                  <span>Warning (80%–99%)</span>
                </span>
                <span className="gap-1.5 flex items-center">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: 'rgb(var(--danger))' }}
                  />
                  <span>Critical Exceeded (&ge;100%)</span>
                </span>
              </div>
              <span>Updated in real-time via telemetry</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-xs"
              aria-label="Budget Allocation Tabular Data"
            >
              <thead>
                <tr className="border-b border-border font-medium text-foreground-muted">
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-right">Allocated Limit</th>
                  <th className="py-2.5 px-3 text-right">Consumed Balance</th>
                  <th className="py-2.5 px-3 text-right">Remaining</th>
                  <th className="py-2.5 px-3 text-right">Utilization</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.map((dept) => {
                  const pct = budgetUtilizationPercent(dept.consumed, dept.allocated);
                  const remaining = Math.max(0, dept.allocated - dept.consumed);
                  const { status } = getThresholdColor(pct);
                  return (
                    <tr
                      key={dept.id}
                      className="transition-colors hover:bg-surface-secondary/40"
                    >
                      <td className="px-3 py-3 font-medium text-foreground">
                        {dept.department}
                      </td>
                      <td className="tabular px-3 py-3 text-right text-foreground">
                        {formatCurrency(dept.allocated, dept.currency || 'USDC')}
                      </td>
                      <td className="tabular px-3 py-3 text-right text-foreground">
                        {formatCurrency(dept.consumed, dept.currency || 'USDC')}
                      </td>
                      <td
                        className={`tabular px-3 py-3 text-right font-medium ${dept.consumed > dept.allocated ? 'text-danger' : 'text-success'}`}
                      >
                        {formatCurrency(remaining, dept.currency || 'USDC')}
                      </td>
                      <td className="tabular px-3 py-3 text-right font-bold">
                        {Number.isFinite(pct) ? `${Math.round(pct)}%` : '∞'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {status === 'danger' && (
                          <Badge variant="danger" size="sm">
                            Exceeded
                          </Badge>
                        )}
                        {status === 'warning' && (
                          <Badge variant="warning" size="sm">
                            Warning
                          </Badge>
                        )}
                        {status === 'normal' && (
                          <Badge variant="success" size="sm">
                            Normal
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BudgetAllocationChart;

'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import { AlertTriangle, ShieldAlert, BarChart3, Table as TableIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChartFrame } from '@/components/charts/chart-frame';
import {
  AXIS_TICK,
  BUDGET_STATUS_COLOR,
  CHART_COLORS,
  budgetStatus,
  utilizationPercent,
  type BudgetStatus,
} from '@/components/charts/theme';
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
}

const DEFAULT_BUDGET_DATA: BudgetDepartmentData[] = [
  { id: '1', department: 'Treasury & Operations', allocated: 25000, consumed: 14500, currency: 'USDC' },
  { id: '2', department: 'Trading & Arbitrage', allocated: 40000, consumed: 34800, currency: 'USDC' },
  { id: '3', department: 'R&D AI Cluster', allocated: 15000, consumed: 16200, currency: 'USDC' },
  { id: '4', department: 'Marketing & Bounties', allocated: 10000, consumed: 4200, currency: 'USDC' },
  { id: '5', department: 'Security Audit Pool', allocated: 30000, consumed: 21000, currency: 'USDC' },
];

/**
 * Status and token color for a utilization percentage: normal below 80%,
 * warning from 80%, danger from 100%. `color` is a theme-aware CSS color.
 */
export function getThresholdColor(percent: number): {
  color: string;
  status: BudgetStatus;
} {
  const status = budgetStatus(percent);
  return { color: BUDGET_STATUS_COLOR[status], status };
}

/** Longest department name drawn on the axis before it is shortened (the tooltip keeps the full name). */
const AXIS_LABEL_MAX = 20;

const shortenLabel = (value: string) =>
  value.length > AXIS_LABEL_MAX ? `${value.slice(0, AXIS_LABEL_MAX - 1)}…` : value;

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data: BudgetDepartmentData = payload[0]?.payload;
  if (!data) return null;

  const utilization = utilizationPercent(data.consumed, data.allocated);
  const remaining = Math.max(0, data.allocated - data.consumed);
  const currency = data.currency || 'USDC';
  const { status, color } = getThresholdColor(utilization);

  return (
    <div
      className="z-50 rounded-lg border border-border bg-surface-primary p-3 shadow-md text-xs space-y-1.5 min-w-[200px]"
      style={{ borderColor: status !== 'normal' ? color : undefined }}
    >
      <p className="font-semibold text-foreground border-b border-border/60 pb-1">{data.department}</p>
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
          <span className={`tabular font-medium ${data.consumed > data.allocated ? 'text-danger' : 'text-success'}`}>
            {data.consumed > data.allocated ? '−' : ''}
            {formatCurrency(remaining, currency)}
          </span>
        </div>
        <div className="flex justify-between items-center gap-4 pt-1 border-t border-border/40">
          <span className="text-foreground-secondary font-medium">Utilization:</span>
          <span className="tabular font-bold" style={{ color }}>
            {Math.round(utilization)}%
          </span>
        </div>
      </div>

      {status === 'warning' && (
        <div className="flex items-center gap-1 text-2xs font-medium text-warning pt-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>Approaching Limit (≥80%)</span>
        </div>
      )}
      {status === 'danger' && (
        <div className="flex items-center gap-1 text-2xs font-semibold text-danger pt-1">
          <ShieldAlert className="h-3 w-3 shrink-0" />
          <span>Budget Limit Exceeded!</span>
        </div>
      )}
    </div>
  );
};

function LegendDot({ status }: { status: BudgetStatus }) {
  return (
    <span
      className="h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: BUDGET_STATUS_COLOR[status] }}
      aria-hidden="true"
    />
  );
}

export function BudgetAllocationChart({
  data = DEFAULT_BUDGET_DATA,
  title = 'Department Budget Allocation & Consumption',
  description = 'Real-time expenditure monitoring with automated 80% & 100% capacity threshold alerts.',
  className = '',
}: BudgetAllocationChartProps) {
  const [showTableView, setShowTableView] = useState<boolean>(false);
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  const warnings = useMemo(() => {
    return data.filter((d) => utilizationPercent(d.consumed, d.allocated) >= 80);
  }, [data]);

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="border-b border-border bg-surface-primary/60 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              aria-label={showTableView ? 'Switch to graphical chart view' : 'Switch to accessible tabular view'}
            >
              {showTableView ? (
                <>
                  <BarChart3 className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                  <span>Chart View</span>
                </>
              ) : (
                <>
                  <TableIcon className="h-3.5 w-3.5 text-foreground-secondary" aria-hidden="true" />
                  <span>Accessible Table</span>
                </>
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {!showTableView ? (
          <div className="space-y-4">
            <ChartFrame
              label="Budget Allocation Chart Graph"
              height={320}
              empty={data.length === 0}
              emptyTitle="No department budgets yet"
              emptyDescription="Allocated and consumed budget per department appears here once budgets are set."
            >
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                  stroke={CHART_COLORS.border}
                  opacity={0.5}
                />
                <XAxis
                  type="number"
                  tickFormatter={(val: number) => formatCurrency(val, 'USDC', { compact: true })}
                  stroke={CHART_COLORS.axis}
                  tick={AXIS_TICK}
                />
                <YAxis
                  type="category"
                  dataKey="department"
                  stroke={CHART_COLORS.axis}
                  tick={{ ...AXIS_TICK, fill: CHART_COLORS.textSecondary }}
                  tickFormatter={shortenLabel}
                  width={130}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  allowEscapeViewBox={{ x: false, y: false }}
                  cursor={{ fill: CHART_COLORS.track, opacity: 0.4 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => <span className="text-foreground-secondary font-medium">{value}</span>}
                />
                <Bar
                  dataKey="allocated"
                  name="Allocated Limit"
                  fill={CHART_COLORS.track}
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
                    const { color } = getThresholdColor(utilizationPercent(entry.consumed, entry.allocated));
                    const isHovered = activeBarIndex === index;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={color}
                        opacity={activeBarIndex === null || isHovered ? 1 : 0.6}
                        style={{
                          transition: 'all 0.2s ease-in-out',
                          filter: isHovered ? 'brightness(1.1)' : 'none',
                        }}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ChartFrame>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-2xs text-foreground-secondary">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <LegendDot status="normal" />
                  <span>Optimal (&lt;80%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <LegendDot status="warning" />
                  <span>Warning (80%–99%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <LegendDot status="danger" />
                  <span>Critical Exceeded (&ge;100%)</span>
                </span>
              </div>
              <span>Updated in real-time via telemetry</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Budget Allocation Tabular Data">
              <thead>
                <tr className="border-b border-border text-foreground-muted font-medium">
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-right">Allocated Limit</th>
                  <th className="py-2.5 px-3 text-right">Consumed Balance</th>
                  <th className="py-2.5 px-3 text-right">Remaining</th>
                  <th className="py-2.5 px-3 text-right">Utilization</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 px-3 text-center text-foreground-secondary">
                      No department budgets yet.
                    </td>
                  </tr>
                )}
                {data.map((dept) => {
                  const pct = utilizationPercent(dept.consumed, dept.allocated);
                  const remaining = Math.max(0, dept.allocated - dept.consumed);
                  const { status } = getThresholdColor(pct);
                  return (
                    <tr key={dept.id} className="hover:bg-surface-secondary/40 transition-colors">
                      <td className="py-3 px-3 font-medium text-foreground">{dept.department}</td>
                      <td className="py-3 px-3 text-right tabular text-foreground">
                        {formatCurrency(dept.allocated, dept.currency || 'USDC')}
                      </td>
                      <td className="py-3 px-3 text-right tabular text-foreground">
                        {formatCurrency(dept.consumed, dept.currency || 'USDC')}
                      </td>
                      <td className={`py-3 px-3 text-right tabular font-medium ${dept.consumed > dept.allocated ? 'text-danger' : 'text-success'}`}>
                        {formatCurrency(remaining, dept.currency || 'USDC')}
                      </td>
                      <td className="py-3 px-3 text-right tabular font-bold">
                        {Math.round(pct)}%
                      </td>
                      <td className="py-3 px-3 text-center">
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

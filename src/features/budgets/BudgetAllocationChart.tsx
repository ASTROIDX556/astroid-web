'use client';

import React, { useState, useMemo } from 'react';
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
  Line,
  LineChart,
} from 'recharts';
import { AlertTriangle, ShieldAlert, BarChart3, Table as TableIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/components/ui/use-toast';

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

export const vestingFormSchema = z
  .object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    amount: z.coerce.number().positive('Amount must be greater than zero.'),
    cliffPeriod: z.coerce
      .number()
      .min(0, 'Cliff period cannot be negative.')
      .max(12, 'Cliff period cannot exceed 12 months.'),
    treasuryLimit: z.coerce.number().positive('Treasury limit must be greater than zero.'),
  })
  .refine((data) => data.amount <= data.treasuryLimit, {
    message: 'Recurring amount cannot exceed the treasury limit.',
    path: ['amount'],
  });

type VestingFormValues = z.infer<typeof vestingFormSchema>;

type VestingFrequency = VestingFormValues['frequency'];

interface ProjectedBalancePoint {
  month: number;
  label: string;
  balance: number;
}

const RECURRENCE_PER_MONTH: Record<VestingFrequency, number> = {
  daily: 365 / 12,
  weekly: 52 / 12,
  monthly: 1,
};

export function buildProjection(values: VestingFormValues): ProjectedBalancePoint[] {
  const points: ProjectedBalancePoint[] = [];
  const perMonth = values.amount * RECURRENCE_PER_MONTH[values.frequency];
  let balance = 0;

  for (let month = 0; month <= 12; month += 1) {
    if (month > 0 && month >= values.cliffPeriod) {
      balance = Math.min(values.treasuryLimit, balance + perMonth);
    }

    points.push({
      month,
      label: month === 0 ? 'Start' : `M${month}`,
      balance: Math.round(balance),
    });
  }

  return points;
}

export function getThresholdColor(utilizationPercent: number): {
  color: string;
  hex: string;
  status: 'normal' | 'warning' | 'danger';
} {
  if (utilizationPercent >= 100) {
    return { color: 'var(--danger)', hex: '#C84747', status: 'danger' };
  }
  if (utilizationPercent >= 80) {
    return { color: 'var(--warning)', hex: '#D98A21', status: 'warning' };
  }
  return { color: 'var(--chart-1)', hex: '#2A78D6', status: 'normal' };
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data: BudgetDepartmentData = payload[0]?.payload;
  if (!data) return null;

  const utilization = data.allocated > 0 ? (data.consumed / data.allocated) * 100 : 0;
  const remaining = Math.max(0, data.allocated - data.consumed);
  const currency = data.currency || 'USDC';
  const { status, hex } = getThresholdColor(utilization);

  return (
    <div
      className="z-50 rounded-lg border border-border bg-surface-primary p-3 shadow-md text-xs space-y-1.5 min-w-[200px]"
      style={{ borderColor: status !== 'normal' ? hex : undefined }}
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
          <span className="tabular font-bold" style={{ color: hex }}>
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

export function BudgetAllocationChart({
  data = DEFAULT_BUDGET_DATA,
  title = 'Department Budget Allocation & Consumption',
  description = 'Real-time expenditure monitoring with automated 80% & 100% capacity threshold alerts.',
  className = '',
}: BudgetAllocationChartProps) {
  const [showTableView, setShowTableView] = useState<boolean>(false);
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  const warnings = useMemo(() => {
    return data.filter((d) => {
      const pct = (d.consumed / d.allocated) * 100;
      return pct >= 80;
    });
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
            <div className="h-80 w-full" role="region" aria-label="Budget Allocation Chart Graph">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    type="number"
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    stroke="var(--text-muted)"
                    fontSize={11}
                  />
                  <YAxis
                    type="category"
                    dataKey="department"
                    stroke="var(--text-secondary)"
                    fontSize={11}
                    width={140}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    allowEscapeViewBox={{ x: false, y: false }}
                    cursor={{ fill: 'var(--surface-secondary)', opacity: 0.4 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={(value) => <span className="text-foreground-secondary font-medium">{value}</span>}
                  />
                  <Bar
                    dataKey="allocated"
                    name="Allocated Limit"
                    fill="var(--surface-secondary)"
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
                      const pct = entry.allocated > 0 ? (entry.consumed / entry.allocated) * 100 : 0;
                      const { hex } = getThresholdColor(pct);
                      const isHovered = activeBarIndex === index;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={hex}
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
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-2xs text-foreground-secondary">
              <div className="flex items-center gap-4">
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
                {data.map((dept) => {
                  const pct = dept.allocated > 0 ? (dept.consumed / dept.allocated) * 100 : 0;
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

export function VestingScheduleBuilder({ className = '' }: { className?: string }) {
  const [savedSchedule, setSavedSchedule] = useState<VestingFormValues | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<VestingFormValues>({
    resolver: zodResolver(vestingFormSchema),
    mode: 'onChange',
    defaultValues: {
      frequency: 'monthly',
      amount: 5000,
      cliffPeriod: 0,
      treasuryLimit: 100000,
    },
  });

  const watchedValues = watch();
  const projection = useMemo(() => {
    const parsed = vestingFormSchema.safeParse(watchedValues);
    return parsed.success ? buildProjection(parsed.data) : [];
  }, [watchedValues]);

  const onSubmit = handleSubmit((values) => {
    setSavedSchedule(values);
    toast({
      title: 'Vesting schedule saved',
      description: `${values.frequency.charAt(0).toUpperCase() + values.frequency.slice(1)} replenishment of ${formatCurrency(values.amount, 'USDC')} with a ${values.cliffPeriod}-month cliff.`,
    });
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Agent Vesting Schedule Builder</CardTitle>
        <CardDescription className="text-xs">
          Configure recurring budget replenishments and preview projected availability.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="frequency" className="text-xs font-medium text-foreground-secondary">Frequency</label>
            <select
              id="frequency"
              className="h-9 w-full rounded-md border border-border bg-surface-primary px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('frequency')}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            {errors.frequency && (
              <p className="text-2xs text-danger" role="alert">{errors.frequency.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="amount" className="text-xs font-medium text-foreground-secondary">Replenishment Amount</label>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="5000"
              className="h-9 w-full rounded-md border border-border bg-surface-primary px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('amount')}
            />
            {errors.amount && (
              <p className="text-2xs text-danger" role="alert">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cliffPeriod" className="text-xs font-medium text-foreground-secondary">Cliff Period (months)</label>
            <input
              id="cliffPeriod"
              type="number"
              inputMode="numeric"
              min="0"
              max="12"
              placeholder="0"
              className="h-9 w-full rounded-md border border-border bg-surface-primary px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('cliffPeriod')}
            />
            {errors.cliffPeriod && (
              <p className="text-2xs text-danger" role="alert">{errors.cliffPeriod.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="treasuryLimit" className="text-xs font-medium text-foreground-secondary">Treasury Limit</label>
            <input
              id="treasuryLimit"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="100000"
              className="h-9 w-full rounded-md border border-border bg-surface-primary px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              {...register('treasuryLimit')}
            />
            {errors.treasuryLimit && (
              <p className="text-2xs text-danger" role="alert">{errors.treasuryLimit.message}</p>
            )}
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-end gap-3">
            {savedSchedule && (
              <span className="text-2xs font-medium text-success">
                Active schedule: {savedSchedule.frequency} · {formatCurrency(savedSchedule.amount, 'USDC')}
              </span>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-gold/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Save Vesting Schedule
            </button>
          </div>
        </form>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">12-Month Projected Availability</h3>
            <span className="text-2xs text-foreground-secondary">Treasury limit: {formatCurrency(Number(watchedValues.treasuryLimit) || 0, 'USDC')}</span>
          </div>
          {projection.length > 0 ? (
            <div className="h-72 w-full" role="region" aria-label="Projected fund availability line graph">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projection} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis
                    tickFormatter={(val) => `$${(Number(val) / 1000).toFixed(0)}k`}
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value), 'USDC'), 'Available']}
                    labelFormatter={(label) => `Horizon: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    name="Projected Available"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-xs text-foreground-secondary">
              Adjust form values to preview the projected vesting curve.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default BudgetAllocationChart;


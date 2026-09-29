'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/DataTable';
import { CATEGORICAL } from '@/components/charts';
import { formatCurrency, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  MOCK_DEPARTMENT_BUDGET_BREAKDOWN,
  departmentUtilizationPercent,
  type DepartmentBudgetBreakdown,
  type DepartmentBudgetChartSlice,
} from '@/types/budget';

export interface DepartmentBudgetBreakdownProps {
  data?: DepartmentBudgetBreakdown[];
  title?: string;
  description?: string;
  className?: string;
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

interface ChartTooltipItem {
  payload?: DepartmentBudgetChartSlice;
}

function AllocationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipItem[];
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0]?.payload;
  if (!slice) return null;

  const utilization = departmentUtilizationPercent({
    allocated: slice.allocated,
    spent: slice.spent,
  });

  return (
    <div className="min-w-[200px] rounded-md border border-border bg-surface-primary px-3 py-2 text-xs shadow-soft-2">
      <p className="mb-1.5 border-b border-border pb-1 font-medium text-foreground">{slice.name}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-foreground-secondary">Allocated</span>
          <span className="tabular font-medium text-foreground">
            {formatCurrency(slice.allocated, slice.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-foreground-secondary">Spent</span>
          <span className="tabular font-medium text-foreground">
            {formatCurrency(slice.spent, slice.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-foreground-secondary">Remaining</span>
          <span
            className={cn(
              'tabular font-medium',
              slice.remaining < 0 ? 'text-danger' : 'text-success',
            )}
          >
            {formatCurrency(slice.remaining, slice.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-1">
          <span className="text-foreground-secondary">Utilization</span>
          <span className="tabular font-medium text-foreground">{formatPercent(utilization)}</span>
        </div>
      </div>
    </div>
  );
}

export function DepartmentBudgetBreakdown({
  data = MOCK_DEPARTMENT_BUDGET_BREAKDOWN,
  title = 'Department budget allocation',
  description = 'How the monthly envelope is split across engineering, marketing, and operations.',
  className,
}: DepartmentBudgetBreakdownProps) {
  const mounted = useMounted();

  const chartData = useMemo<DepartmentBudgetChartSlice[]>(
    () =>
      data.map((row, index) => ({
        name: row.department,
        departmentKey: row.departmentKey,
        allocated: row.allocated,
        spent: row.spent,
        remaining: row.remaining,
        currency: row.currency,
        fill: CATEGORICAL[index % CATEGORICAL.length] ?? 'rgb(var(--chart-1))',
      })),
    [data],
  );

  const totalAllocated = useMemo(
    () => data.reduce((sum, row) => sum + row.allocated, 0),
    [data],
  );
  const currency = data[0]?.currency ?? 'USDC';

  const columns = useMemo<ColumnDef<DepartmentBudgetBreakdown, unknown>[]>(
    () => [
      {
        accessorKey: 'department',
        header: 'Department',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  CATEGORICAL[
                    data.findIndex((item) => item.id === row.original.id) % CATEGORICAL.length
                  ] ?? 'rgb(var(--chart-1))',
              }}
              aria-hidden
            />
            <span className="font-medium text-foreground">{row.original.department}</span>
          </div>
        ),
      },
      {
        accessorKey: 'allocated',
        header: 'Allocated',
        cell: ({ row }) => (
          <span className="tabular text-foreground">
            {formatCurrency(row.original.allocated, row.original.currency)}
          </span>
        ),
        meta: { className: 'text-right' },
      },
      {
        accessorKey: 'spent',
        header: 'Spent',
        cell: ({ row }) => (
          <span className="tabular text-foreground">
            {formatCurrency(row.original.spent, row.original.currency)}
          </span>
        ),
        meta: { className: 'text-right' },
      },
      {
        accessorKey: 'remaining',
        header: 'Remaining',
        cell: ({ row }) => (
          <span
            className={cn(
              'tabular font-medium',
              row.original.remaining < 0 ? 'text-danger' : 'text-success',
            )}
          >
            {formatCurrency(row.original.remaining, row.original.currency)}
          </span>
        ),
        meta: { className: 'text-right' },
      },
      {
        id: 'utilization',
        accessorFn: (row) => departmentUtilizationPercent(row),
        header: 'Utilization',
        cell: ({ row }) => (
          <span className="tabular text-foreground">
            {formatPercent(departmentUtilizationPercent(row.original))}
          </span>
        ),
        meta: { className: 'text-right' },
      },
    ],
    [data],
  );

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b border-border bg-surface-secondary/40 pb-4">
        <div className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-gold" aria-hidden />
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div className="h-80 w-full" role="img" aria-label="Department budget allocation donut chart">
            {!mounted ? (
              <div className="skeleton h-full w-full rounded-md" />
            ) : (
              <div className="flex h-full w-full flex-col">
                <div className="relative min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="allocated"
                        nameKey="name"
                        innerRadius="58%"
                        outerRadius="88%"
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {chartData.map((slice) => (
                          <Cell key={slice.departmentKey} fill={slice.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<AllocationTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-xl font-semibold tracking-tight tabular text-foreground">
                      {formatCurrency(totalAllocated, currency, { compact: true })}
                    </span>
                    <span className="text-2xs uppercase tracking-wide text-foreground-secondary">
                      Total allocated
                    </span>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  {chartData.map((slice) => (
                    <li key={slice.departmentKey} className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: slice.fill }}
                        aria-hidden
                      />
                      {slice.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DataTable
            data={data}
            columns={columns}
            getRowId={(row) => row.id}
            caption="Per department"
            pageSize={data.length}
            emptyState={
              <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center text-sm text-foreground-secondary">
                No department budget data.
              </div>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default DepartmentBudgetBreakdown;

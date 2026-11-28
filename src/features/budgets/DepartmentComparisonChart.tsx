'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CHART_COLORS, CHART_TOKENS } from '@/components/charts/theme';
import { formatCurrency } from '@/lib/format';
import {
  buildDepartmentComparisonData,
  type DepartmentComparisonRow,
} from './departmentComparisonUtils';
import type { DepartmentBudget } from './types';

export interface DepartmentComparisonChartProps {
  departments: readonly DepartmentBudget[];
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload?: DepartmentComparisonRow }[];
}

function ComparisonTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="space-y-1 rounded-md border border-border bg-surface p-3 text-xs shadow-soft-2">
      <p className="font-medium text-foreground">{row.department}</p>
      <p className="text-foreground-secondary">
        Allocated: {formatCurrency(row.allocated, row.asset)}
      </p>
      <p className="text-foreground-secondary">
        Consumed: {formatCurrency(row.consumed, row.asset)}
      </p>
      <p className="font-medium text-foreground">
        Utilization:{' '}
        {row.utilizationPercent === null
          ? 'No allocation'
          : `${row.utilizationPercent.toFixed(2)}%`}
      </p>
    </div>
  );
}

export function DepartmentComparisonChart({
  departments,
}: DepartmentComparisonChartProps) {
  const data = useMemo(() => buildDepartmentComparisonData(departments), [departments]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-surface-secondary/40">
        <CardTitle className="text-base font-semibold">
          Department budget allocation comparison
        </CardTitle>
        <CardDescription>
          Allocated and consumed funds by department. Hover for exact amounts and
          utilization; consumption remains visible when it exceeds allocation.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        {data.length === 0 ? (
          <div
            className="min-h-64 grid place-items-center rounded-md border border-dashed border-border bg-surface-secondary/30 px-6 text-center text-sm text-foreground-secondary"
            role="status"
          >
            No department budget data is available yet.
          </div>
        ) : (
          <div
            className="h-72 w-full min-w-0"
            role="img"
            aria-label="Department comparison chart of allocated and consumed budgets"
          >
            <ResponsiveContainer width="100%" height="100%" debounce={80}>
              <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid
                  stroke={CHART_COLORS.grid}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="department"
                  tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_COLORS.axis }}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat('en-US', {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                />
                <Tooltip content={<ComparisonTooltip />} />
                <Legend />
                <Bar
                  dataKey="allocated"
                  name="Allocated"
                  fill={CHART_TOKENS.info}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="consumed"
                  name="Consumed"
                  fill={CHART_TOKENS.gold}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DepartmentComparisonChart;

'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/format';
import type {
  AgentSpend,
  BudgetWaterfallStep,
  SpendingByCategory,
  TimeseriesPoint,
} from '@/types/domain';

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

const AXIS = 'rgb(var(--chart-axis))';
const GRID = 'rgb(var(--chart-grid))';
const TEXT = 'rgb(var(--text-muted))';
const GOLD = 'rgb(var(--gold))';
const SUCCESS = 'rgb(var(--success))';
const DANGER = 'rgb(var(--danger))';

export const CATEGORICAL = [
  'rgb(var(--chart-1))',
  'rgb(var(--chart-2))',
  'rgb(var(--chart-3))',
  'rgb(var(--chart-4))',
  'rgb(var(--chart-5))',
  'rgb(var(--chart-6))',
  'rgb(var(--chart-7))',
  'rgb(var(--chart-8))',
];

const axisTick = {
  fill: TEXT,
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
};

export interface TooltipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export function ChartTooltipShell({
  label,
  children,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass min-w-[160px] rounded-md px-3 py-2 text-xs shadow-soft-2">
      {label != null && (
        <p className="mb-1.5 font-medium text-foreground">{label}</p>
      )}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

// ---------------------------------------------------------------------------
// Cashflow — layered area chart (inflow / outflow)
// ---------------------------------------------------------------------------
export function CashflowChart({
  data,
  height = 260,
}: {
  data?: TimeseriesPoint[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted || !data || !Array.isArray(data)) {
    return <div className="skeleton w-full rounded-md" style={{ height }} />;
  }
  return (

    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="inflow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SUCCESS} stopOpacity={0.28} />
            <stop offset="100%" stopColor={SUCCESS} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="outflow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.3} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={axisTick}
          axisLine={{ stroke: AXIS }}
          tickLine={false}
          minTickGap={32}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(v: number) => formatCurrency(v, 'USDC', { compact: true })}
        />
        <RechartsTooltip
          cursor={{ stroke: GRID, strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const items = payload as TooltipPayloadItem[];
            return (
              <ChartTooltipShell label={shortDate(String(label))}>
                {items.map((item) => (
                  <div
                    key={String(item.dataKey)}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="flex items-center gap-1.5 capitalize text-foreground-secondary">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}
                    </span>
                    <span className="tabular font-medium text-foreground">
                      {formatCurrency(Number(item.value), 'USDC', { compact: true })}
                    </span>
                  </div>
                ))}
              </ChartTooltipShell>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="inflow"
          name="Inflow"
          stroke={SUCCESS}
          strokeWidth={2}
          fill="url(#inflow)"
        />
        <Area
          type="monotone"
          dataKey="outflow"
          name="Outflow"
          stroke={GOLD}
          strokeWidth={2}
          fill="url(#outflow)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Spending by category — horizontal bars
// ---------------------------------------------------------------------------
export function CategoryBarChart({
  data,
  height = 260,
}: {
  data?: SpendingByCategory[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted || !data || !Array.isArray(data)) {
    return <div className="skeleton w-full rounded-md" style={{ height }} />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <XAxis
          type="number"
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatCurrency(v, 'USDC', { compact: true })}
        />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ ...axisTick, fontFamily: 'var(--font-sans)' }}
          axisLine={false}
          tickLine={false}
          width={128}
        />
        <RechartsTooltip
          cursor={{ fill: GRID, fillOpacity: 0.3 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = (payload as TooltipPayloadItem[])[0];
            const row = item?.payload as SpendingByCategory | undefined;
            if (!row) return null;
            return (
              <ChartTooltipShell label={row.category}>
                <span className="tabular font-medium text-foreground">
                  {formatCurrency(row.amount, 'USDC')}
                </span>
              </ChartTooltipShell>
            );
          }}
        />
        <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Agent spend — vertical bars
// ---------------------------------------------------------------------------
export function AgentSpendChart({
  data,
  height = 260,
}: {
  data?: AgentSpend[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted || !data || !Array.isArray(data)) {
    return <div className="skeleton w-full rounded-md" style={{ height }} />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="agentName"
          tick={{ ...axisTick, fontFamily: 'var(--font-sans)' }}
          axisLine={{ stroke: AXIS }}
          tickLine={false}
          interval="preserveStartEnd"
          tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 10)}...` : v)}
        />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(v: number) => formatCurrency(v, 'USDC', { compact: true })}
        />
        <RechartsTooltip
          cursor={{ fill: GRID, fillOpacity: 0.3 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = (payload as TooltipPayloadItem[])[0]?.payload as
              | AgentSpend
              | undefined;
            if (!row) return null;
            return (
              <ChartTooltipShell label={row.agentName}>
                <span className="tabular font-medium text-foreground">
                  {formatCurrency(row.spent, 'USDC')}
                </span>
                <span className="text-foreground-secondary">
                  {row.transactions} transactions
                </span>
              </ChartTooltipShell>
            );
          }}
        />
        <Bar dataKey="spent" radius={[6, 6, 0, 0]} barSize={36}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Donut — generic labelled distribution
// ---------------------------------------------------------------------------
export interface DonutDatum {
  name: string;
  value: number;
  color?: string;
}

export function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
}: {
  data?: DonutDatum[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const mounted = useMounted();
  if (!mounted || !data || !Array.isArray(data)) {
    return <div className="skeleton w-full rounded-md" style={{ height }} />;
  }

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? CATEGORICAL[i % CATEGORICAL.length]} />
            ))}
          </Pie>
          <RechartsTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = (payload as TooltipPayloadItem[])[0];
              if (!item) return null;
              return (
                <ChartTooltipShell label={String(item.name)}>
                  <span className="tabular font-medium text-foreground">
                    {Number(item.value).toLocaleString('en-US')}
                  </span>
                </ChartTooltipShell>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="font-display text-3xl font-semibold tracking-tight">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-2xs uppercase tracking-wide text-foreground-secondary">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Budget waterfall — running total with spend/remaining coloring
// ---------------------------------------------------------------------------
interface WaterfallBar extends BudgetWaterfallStep {
  base: number;
  span: number;
}

function buildWaterfall(steps: BudgetWaterfallStep[]): WaterfallBar[] {
  let running = 0;
  return steps.map((step) => {
    if (step.kind === 'total' || step.kind === 'remaining') {
      const bar = { ...step, base: 0, span: Math.abs(step.value) };
      running = step.kind === 'total' ? step.value : running;
      return bar;
    }
    // spend: negative value drawn from running down
    const top = running;
    running += step.value; // value is negative
    return { ...step, base: running, span: top - running };
  });
}

export function WaterfallChart({
  data,
  height = 280,
}: {
  data: BudgetWaterfallStep[];
  height?: number;
}) {
  const bars = buildWaterfall(data);
  const colorFor = (kind: BudgetWaterfallStep['kind']) =>
    kind === 'total' ? GOLD : kind === 'remaining' ? SUCCESS : 'rgb(var(--chart-2))';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ ...axisTick, fontFamily: 'var(--font-sans)' }}
          axisLine={{ stroke: AXIS }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(v: number) => formatCurrency(v, 'USDC', { compact: true })}
        />
        <RechartsTooltip
          cursor={{ fill: GRID, fillOpacity: 0.3 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = (payload as TooltipPayloadItem[])[0]?.payload as
              | WaterfallBar
              | undefined;
            if (!row) return null;
            return (
              <ChartTooltipShell label={row.label}>
                <span className="tabular font-medium text-foreground">
                  {formatCurrency(Math.abs(row.value), 'USDC')}
                </span>
              </ChartTooltipShell>
            );
          }}
        />
        <ReferenceLine y={0} stroke={AXIS} />
        <Bar dataKey="base" stackId="w" fill="transparent" />
        <Bar dataKey="span" stackId="w" radius={[6, 6, 0, 0]} barSize={44}>
          {bars.map((b, i) => (
            <Cell key={i} fill={colorFor(b.kind)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — tiny inline area (net cashflow)
// ---------------------------------------------------------------------------
export function Sparkline({
  data,
  dataKey = 'net',
  positive = true,
  height = 44,
}: {
  data: TimeseriesPoint[];
  dataKey?: keyof TimeseriesPoint;
  positive?: boolean;
  height?: number;
}) {
  const color = positive ? SUCCESS : DANGER;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.24} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey={dataKey as string}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${dataKey})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

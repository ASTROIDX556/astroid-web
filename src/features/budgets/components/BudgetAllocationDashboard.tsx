'use client';

import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Coins,
  Gauge,
  Layers,
  PieChart as PieChartIcon,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  CATEGORICAL,
  ChartTooltipShell,
  type TooltipPayloadItem,
} from '@/components/charts';
import { cn } from '@/lib/cn';
import { formatCurrency, formatPercent, formatRelativeTime } from '@/lib/format';

import { MOCK_DEPARTMENT_BUDGETS } from '../mock-data';
import type { AgentAllocation, AssetCode, DepartmentBudget } from '../types';

/* -------------------------------------------------------------------------- */
/* Precision math                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The whole department pool expressed in basis points. Every allocation is held
 * as an **integer** number of bps (1 % === 100 bps) so the aggregate can be
 * summed exactly — `0.1 + 0.2 !== 0.3` style float drift can never leak into the
 * "unallocated remaining" readout or the breach check.
 */
export const FULL_POOL_BPS = 10_000;

/** Clamp + integralize a basis-point value. Non-finite input falls back to `min`. */
export function clampBps(bps: number, min = 0, max = FULL_POOL_BPS): number {
  if (!Number.isFinite(bps)) return min;
  return Math.min(max, Math.max(min, Math.round(bps)));
}

/** Percent (0–100) → integer basis points. */
export function percentToBps(percent: number): number {
  return clampBps(percent * 100);
}

/** Integer basis points → percent (0–100). */
export function bpsToPercent(bps: number): number {
  return clampBps(bps) / 100;
}

/** Currency rounding that survives binary float noise (`1234.565` → `1234.57`). */
export function roundAmount(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON * value) * factor) / factor;
}

/** Signed pool share for a bps value — **not** clamped, so overruns stay negative. */
export function bpsToAmount(pool: number, bps: number): number {
  if (!Number.isFinite(pool)) return 0;
  return roundAmount((pool * bps) / FULL_POOL_BPS);
}

export interface AllocationRowInput {
  id: string;
  /** Allocation as integer basis points of the department pool. */
  bps: number;
}

export interface AllocationRowResult extends AllocationRowInput {
  percent: number;
  amount: number;
}

export interface AllocationSummary {
  rows: AllocationRowResult[];
  /** Exact integer sum of every allocation. */
  allocatedBps: number;
  allocatedPercent: number;
  allocatedAmount: number;
  /** Pool minus allocations. Negative while over-allocated. */
  unallocatedBps: number;
  unallocatedPercent: number;
  unallocatedAmount: number;
  /** Unallocated floor-ed at zero — what is still spendable. */
  availableBps: number;
  availableAmount: number;
  /** Bps (and amount) over the pool; `0` when within budget. */
  overBps: number;
  overAmount: number;
  isOverAllocated: boolean;
  isFullyAllocated: boolean;
}

/**
 * Single source of truth for the widget arithmetic. Pure + integer based, so it
 * can be unit tested without a DOM and never accumulates rounding error.
 */
export function computeAllocationSummary(
  pool: number,
  rows: AllocationRowInput[],
): AllocationSummary {
  const resolved: AllocationRowResult[] = rows.map((row) => {
    const bps = clampBps(row.bps);
    return {
      id: row.id,
      bps,
      percent: bps / 100,
      amount: bpsToAmount(pool, bps),
    };
  });

  // Integer addition — exact regardless of how many rows are summed.
  const allocatedBps = resolved.reduce((total, row) => total + row.bps, 0);
  const unallocatedBps = FULL_POOL_BPS - allocatedBps;
  const overBps = Math.max(0, allocatedBps - FULL_POOL_BPS);

  return {
    rows: resolved,
    allocatedBps,
    allocatedPercent: allocatedBps / 100,
    allocatedAmount: bpsToAmount(pool, allocatedBps),
    unallocatedBps,
    unallocatedPercent: unallocatedBps / 100,
    unallocatedAmount: bpsToAmount(pool, unallocatedBps),
    availableBps: Math.max(0, unallocatedBps),
    availableAmount: bpsToAmount(pool, Math.max(0, unallocatedBps)),
    overBps,
    overAmount: bpsToAmount(pool, overBps),
    isOverAllocated: allocatedBps > FULL_POOL_BPS,
    isFullyAllocated: allocatedBps === FULL_POOL_BPS,
  };
}

/**
 * Largest-remainder apportionment: scale the current shares so they total
 * exactly `FULL_POOL_BPS`. Rounding each share independently would leave the
 * sum at 99.99 % or 100.01 %, so the leftover basis points are handed to the
 * rows with the biggest fractional remainders.
 */
export function normalizeToPool(rows: AllocationRowInput[]): AllocationRowInput[] {
  if (rows.length === 0) return [];

  const total = rows.reduce((sum, row) => sum + clampBps(row.bps), 0);
  const raw = rows.map((row) =>
    total > 0
      ? (clampBps(row.bps) / total) * FULL_POOL_BPS
      : FULL_POOL_BPS / rows.length,
  );

  const floored = raw.map((value) => Math.floor(value));
  let leftover = FULL_POOL_BPS - floored.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  let cursor = 0;
  while (leftover > 0 && order.length > 0) {
    const entry = order[cursor % order.length];
    cursor += 1;
    leftover -= 1;
    if (entry) floored[entry.index] = (floored[entry.index] ?? 0) + 1;
  }

  return rows.map((row, index) => ({ id: row.id, bps: clampBps(floored[index] ?? 0) }));
}

/** Equal apportionment that still totals exactly 100 %. */
export function evenSplit(rows: AllocationRowInput[]): AllocationRowInput[] {
  return normalizeToPool(rows.map((row) => ({ id: row.id, bps: 1 })));
}

/** Seed allocations from the amounts already recorded against the department. */
export function buildInitialAllocations(
  department: DepartmentBudget,
): Record<string, number> {
  const pool = department.totalLimit;
  const recorded: AllocationRowInput[] = department.agents.map((agent) => ({
    id: agent.id,
    bps: pool > 0 ? Math.round((agent.allocatedAmount / pool) * FULL_POOL_BPS) : 0,
  }));

  return recorded.reduce<Record<string, number>>((acc, row) => {
    acc[row.id] = clampBps(row.bps);
    return acc;
  }, {});
}

/* -------------------------------------------------------------------------- */
/* Deterministic 14-day consumption history                                    */
/* -------------------------------------------------------------------------- */

export interface ConsumptionPoint {
  label: string;
  index: number;
  /** Cumulative department spend up to and including this day. */
  spent: number;
  /** Daily burn that produced it — drives the trend area. */
  daily: number;
}

/** Small stable string hash so the mock history never changes between renders. */
function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 1000) / 1000;
}

/**
 * Reconstructs a deterministic day-by-day burn for a department so the Recharts
 * trend has real history to draw. Weights vary per agent/day but always resolve
 * to the department total, and the series is stable across re-renders (no
 * hydration or drag-time flicker).
 */
export function buildConsumptionHistory(
  department: DepartmentBudget,
  days = 14,
): ConsumptionPoint[] {
  const weights = Array.from({ length: days }, (_, dayIndex) => {
    const blended = department.agents.reduce(
      (sum, agent) => sum + 0.55 + hashSeed(`${agent.agentId}:${dayIndex}`) * 0.9,
      0,
    );
    // Velocity nudges the recent end of the window so the line has a shape.
    const recency = 1 + (dayIndex / Math.max(1, days - 1)) * 0.6;
    return Math.max(0.05, blended * recency);
  });

  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endOfDay = new Date();
  endOfDay.setHours(0, 0, 0, 0);

  let cumulative = 0;
  return Array.from({ length: days }, (_, dayIndex) => {
    const day = new Date(endOfDay);
    day.setDate(endOfDay.getDate() - (days - 1 - dayIndex));
    const previous = cumulative;
    // The final point is pinned to the recorded total so the line never drifts
    // off the department figure through repeated float multiplication.
    const ratio =
      dayIndex === days - 1 ? 1 : cumulativeWeight(weights, dayIndex) / weightTotal;
    cumulative = roundAmount(department.totalSpent * ratio);
    return {
      label: formatter.format(day),
      index: dayIndex,
      spent: cumulative,
      daily: roundAmount(Math.max(0, cumulative - previous)),
    };
  });
}

function cumulativeWeight(weights: number[], through: number): number {
  let total = 0;
  for (let i = 0; i <= through; i += 1) total += weights[i] ?? 0;
  return total;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface AllocationChange {
  departmentId: string;
  asset: AssetCode;
  pool: number;
  allocatedBps: number;
  allocatedAmount: number;
  unallocatedBps: number;
  unallocatedAmount: number;
  isOverAllocated: boolean;
  rows: AllocationRowResult[];
}

export interface BudgetAllocationDashboardProps {
  /** Department pools the manager can switch between. */
  departments?: DepartmentBudget[];
  /** Pool to open first. */
  defaultDepartmentId?: string;
  /** Slider increment in percent (kept integral so bps stay exact). */
  step?: number;
  title?: string;
  description?: string;
  className?: string;
  /** Fires on every allocation edit — drag tick, preset, or reset. */
  onAllocationChange?: (change: AllocationChange) => void;
}

type ConsumptionState = 'healthy' | 'watch' | 'over' | 'unfunded';

/* -------------------------------------------------------------------------- */
/* Shared presentation helpers                                                 */
/* -------------------------------------------------------------------------- */

const AXIS = 'rgb(var(--chart-axis))';
const GRID = 'rgb(var(--chart-grid))';
const TICK = {
  fill: 'rgb(var(--text-muted))',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
};
const UNALLOCATED_COLOR = 'rgb(var(--border-strong))';

function sliceColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length] ?? 'rgb(var(--gold))';
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Consumption of an agent measured against its *live* allocation cap. */
function consumptionState(
  agent: AgentAllocation,
  allocatedAmount: number,
): ConsumptionState {
  if (allocatedAmount <= 0) return agent.spentAmount > 0 ? 'unfunded' : 'healthy';
  const pct = (agent.spentAmount / allocatedAmount) * 100;
  if (pct >= 100) return 'over';
  if (pct >= 80) return 'watch';
  return 'healthy';
}

const CONSUMPTION_META: Record<
  ConsumptionState,
  { label: string; variant: 'success' | 'warning' | 'danger'; bar: string }
> = {
  healthy: { label: 'Healthy', variant: 'success', bar: 'bg-success' },
  watch: { label: 'Watch', variant: 'warning', bar: 'bg-warning' },
  over: { label: 'Over cap', variant: 'danger', bar: 'bg-danger' },
  unfunded: { label: 'Unfunded', variant: 'danger', bar: 'bg-danger' },
};

/**
 * Native `input[type=range]` kept for its built-in keyboard contract (arrows,
 * PageUp/Down, Home/End) while the track, fill, tick and thumb are painted by
 * the overlay below it — so the visuals match the design tokens in every
 * browser instead of relying on `::-webkit-slider-thumb` alone.
 */
const RANGE_INPUT_CLASS = [
  'absolute inset-0 h-[44px] w-full cursor-pointer appearance-none bg-transparent',
  'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
  '[&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:opacity-0',
  '[&::-moz-range-track]:h-full [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:border-0',
  '[&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:border-0',
  '[&::-moz-range-thumb]:bg-transparent [&::-moz-range-thumb]:opacity-0',
].join(' ');

const THUMB_SIZE = 24; // px — the input itself is 44px tall for touch targets

/* -------------------------------------------------------------------------- */
/* Slider                                                                      */
/* -------------------------------------------------------------------------- */

export interface AllocationSliderProps {
  id: string;
  label: string;
  /** 0–100. */
  value: number;
  step: number;
  asset: AssetCode;
  amount: number;
  accent: string;
  /** 0–100 — where actual spend sits inside the current cap. */
  consumedPercent: number;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
  onChange: (id: string, percent: number) => void;
}

/**
 * Percentage slider with a 44×44px minimum touch target, an `aria-valuetext`
 * that reads both the share and the currency amount, and a painted thumb that
 * stays pixel-aligned with the native input at any viewport width (the fill is
 * percentage-driven, so resizing the window never desynchronizes it).
 */
export const AllocationSlider = memo(function AllocationSlider({
  id,
  label,
  value,
  step,
  asset,
  amount,
  accent,
  consumedPercent,
  invalid = false,
  disabled = false,
  describedBy,
  onChange,
}: AllocationSliderProps) {
  const [focused, setFocused] = useState(false);
  const percent = clampPercent(value);
  const tick = clampPercent(consumedPercent);

  return (
    <div className="relative h-[44px] w-full px-3">
      <div className="relative h-full w-full">
        {/* Track */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-surface-secondary"
        />
        {/* Consumed segment — how much of the cap is already burnt */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-foreground/15"
          style={{ width: `${Math.min(tick, percent)}%` }}
        />
        {/* Allocation fill */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full"
          style={{
            backgroundColor: invalid ? 'rgb(var(--danger))' : accent,
            width: `${percent}%`,
          }}
        />
        {/* Spend marker — sits where real consumption ends */}
        {tick > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/45"
            style={{ left: `${tick}%` }}
          />
        )}
        {/* Thumb */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-surface shadow-soft-1"
          style={{
            left: `${percent}%`,
            height: THUMB_SIZE,
            width: THUMB_SIZE,
            borderColor: invalid ? 'rgb(var(--danger))' : accent,
          }}
          animate={{ scale: focused ? 1.12 : 1 }}
          transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
        />
        {focused && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-ring ring-offset-2 ring-offset-surface"
            style={{ left: `${percent}%` }}
          />
        )}
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={step}
          value={percent}
          disabled={disabled}
          aria-label={`${label} allocation share of the department pool`}
          aria-valuetext={`${percent.toFixed(step < 1 ? 1 : 0)} percent of the pool, ${formatCurrency(amount, asset)}`}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={RANGE_INPUT_CLASS}
          onChange={(event) => onChange(id, Number(event.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Agent row                                                                   */
/* -------------------------------------------------------------------------- */

interface AgentRowProps {
  agent: AgentAllocation;
  index: number;
  percent: number;
  amount: number;
  step: number;
  invalid: boolean;
  highlighted: boolean;
  onChange: (id: string, percent: number) => void;
  onHover: (id: string | null) => void;
}

const AgentRow = memo(function AgentRow({
  agent,
  index,
  percent,
  amount,
  step,
  invalid,
  highlighted,
  onChange,
  onHover,
}: AgentRowProps) {
  const reactId = useId();
  const sliderId = `${reactId}-slider`;
  const hintId = `${reactId}-hint`;
  const accent = sliceColor(index);
  const state = consumptionState(agent, amount);
  const meta = CONSUMPTION_META[state];
  const consumedPercent =
    amount > 0 ? (agent.spentAmount / amount) * 100 : agent.spentAmount > 0 ? 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: index * 0.04 }}
      onMouseEnter={() => onHover(agent.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'rounded-card border bg-surface p-4 transition-colors duration-fast',
        invalid ? 'border-danger/60 bg-danger-soft/40' : 'border-border',
        highlighted && !invalid && 'border-gold/50 bg-gold-soft/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="gap-2.5 flex min-w-0 items-start">
          <span
            aria-hidden
            className="h-2.5 w-2.5 mt-1 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <div className="min-w-0">
            <label
              htmlFor={sliderId}
              className="block truncate text-sm font-medium text-foreground"
            >
              {agent.agentName}
            </label>
            <p className="truncate text-2xs text-foreground-muted">{agent.role}</p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              'tabular font-display text-xl font-semibold leading-none',
              invalid ? 'text-danger' : 'text-foreground',
            )}
          >
            {formatPercent(percent, step < 1 ? 1 : 0)}
          </p>
          <p className="tabular mt-1 text-2xs text-foreground-secondary">
            {formatCurrency(amount, agent.asset, { compact: true })}
          </p>
        </div>
      </div>

      <AllocationSlider
        id={sliderId}
        label={agent.agentName}
        value={percent}
        step={step}
        asset={agent.asset}
        amount={amount}
        accent={accent}
        consumedPercent={consumedPercent}
        invalid={invalid}
        describedBy={hintId}
        onChange={onChange}
      />

      <div className="mt-1 flex items-center justify-between gap-3 text-2xs">
        <span className="tabular text-foreground-muted">0%</span>
        <span className="tabular text-foreground-muted">100% of pool</span>
      </div>

      <p id={hintId} className="sr-only">
        {`Drag with the pointer or use the arrow keys to change the share of the ${agent.asset} pool. Current spend is ${formatCurrency(agent.spentAmount, agent.asset)}.`}
      </p>

      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between gap-2 text-2xs">
          <span className="gap-1.5 inline-flex items-center text-foreground-secondary">
            <Gauge className="h-3.5 w-3.5" aria-hidden />
            Consumed
          </span>
          <span className="tabular text-foreground">
            {formatCurrency(agent.spentAmount, agent.asset, { compact: true })}
            <span className="text-foreground-muted">
              {' '}
              · {formatPercent(Math.min(consumedPercent, 999), 0)}
            </span>
          </span>
        </div>

        <div
          role="progressbar"
          aria-label={`${agent.agentName} consumption of its allocation cap`}
          aria-valuenow={Math.round(clampPercent(consumedPercent))}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary"
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-base ease-astroid',
              meta.bar,
            )}
            style={{ width: `${clampPercent(consumedPercent)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={meta.variant} size="sm" dot>
            {meta.label}
          </Badge>
          <span className="tabular inline-flex items-center gap-1 text-2xs text-foreground-muted">
            <TrendingUp className="h-3 w-3" aria-hidden />
            {formatCurrency(agent.velocity24h, agent.asset, { compact: true })}/24h
          </span>
        </div>
      </div>
    </motion.div>
  );
});

/* -------------------------------------------------------------------------- */
/* Allocation donut                                                            */
/* -------------------------------------------------------------------------- */

interface ShareDatum {
  id: string;
  name: string;
  value: number;
  color: string;
}

function AllocationDonutTooltip({
  active,
  payload,
  asset,
  pool,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  asset: AssetCode;
  pool: number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  if (!item) return null;
  const bps = Number(item.payload?.value ?? 0);
  return (
    <ChartTooltipShell label={String(item.name)}>
      <span className="tabular font-medium text-foreground">
        {formatPercent(bps / 100, 2)}
      </span>
      <span className="tabular text-foreground-secondary">
        {formatCurrency(bpsToAmount(pool, bps), asset)}
      </span>
    </ChartTooltipShell>
  );
}

function AllocationDonut({
  data,
  asset,
  pool,
  allocatedPercent,
  isOverAllocated,
  activeId,
  onHover,
}: {
  data: ShareDatum[];
  asset: AssetCode;
  pool: number;
  allocatedPercent: number;
  isOverAllocated: boolean;
  activeId: string | null;
  onHover: (id: string | null) => void;
}) {
  const activeIndex = data.findIndex((datum) => datum.id === activeId);

  return (
    <div className="relative h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="92%"
            paddingAngle={data.length > 1 ? 2 : 0}
            strokeWidth={0}
            isAnimationActive={false}
            onMouseEnter={(_, index) => onHover(data[index]?.id ?? null)}
            onMouseLeave={() => onHover(null)}
          >
            {data.map((datum, index) => (
              <Cell
                key={datum.id}
                fill={datum.color}
                fillOpacity={activeIndex === -1 || activeIndex === index ? 1 : 0.35}
              />
            ))}
          </Pie>
          <RechartsTooltip
            content={<AllocationDonutTooltip asset={asset} pool={pool} />}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={cn(
            'tabular font-display text-3xl font-semibold leading-none tracking-tight',
            isOverAllocated ? 'text-danger' : 'text-foreground',
          )}
        >
          {formatPercent(allocatedPercent, allocatedPercent % 1 === 0 ? 0 : 1)}
        </span>
        <span className="mt-1 text-2xs uppercase tracking-wide text-foreground-secondary">
          {isOverAllocated ? 'over pool' : 'of pool allocated'}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Consumption trend                                                           */
/* -------------------------------------------------------------------------- */

function ConsumptionTrend({
  history,
  cap,
  asset,
}: {
  history: ConsumptionPoint[];
  cap: number;
  asset: AssetCode;
}) {
  const data = useMemo(
    () => history.map((point) => ({ ...point, cap })),
    [history, cap],
  );

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="budget-allocation-burn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--gold))" stopOpacity={0.32} />
              <stop offset="100%" stopColor="rgb(var(--gold))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={TICK}
            axisLine={{ stroke: AXIS }}
            tickLine={false}
            minTickGap={24}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={54}
            tickFormatter={(value: number) =>
              formatCurrency(value, asset, { compact: true })
            }
          />
          <RechartsTooltip
            cursor={{ stroke: GRID, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = (payload as TooltipPayloadItem[])[0]?.payload as
                | (ConsumptionPoint & { cap: number })
                | undefined;
              if (!row) return null;
              return (
                <ChartTooltipShell label={String(label)}>
                  <span className="flex items-center justify-between gap-4">
                    <span className="text-foreground-secondary">Cumulative spend</span>
                    <span className="tabular font-medium text-foreground">
                      {formatCurrency(row.spent, asset, { compact: true })}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-4">
                    <span className="text-foreground-secondary">Daily burn</span>
                    <span className="tabular font-medium text-foreground">
                      {formatCurrency(row.daily, asset, { compact: true })}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-4 border-t border-border/40 pt-1">
                    <span className="text-foreground-secondary">Allocation cap</span>
                    <span className="tabular font-medium text-foreground">
                      {formatCurrency(row.cap, asset, { compact: true })}
                    </span>
                  </span>
                </ChartTooltipShell>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="spent"
            name="Cumulative spend"
            stroke="rgb(var(--gold))"
            strokeWidth={2}
            fill="url(#budget-allocation-burn)"
            isAnimationActive={false}
          />
          <Line
            type="stepAfter"
            dataKey="cap"
            name="Allocation cap"
            stroke="rgb(var(--danger))"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

/** Keeps the latest callback without making the drag path depend on identity. */
function useAllocationChangeCallback(handler?: (change: AllocationChange) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  return ref;
}

/** Charts are date-derived, so paint them after hydration to avoid mismatches. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Real-time budget allocation dashboard.
 *
 * Department heads drag a percentage slider per agent; the widget keeps the
 * aggregate inside the department pool, recomputes the unallocated remainder on
 * every tick, flags breaches with alert states, and mirrors the split in a
 * Recharts donut plus a 14-day consumption trend.
 */
export function BudgetAllocationDashboard({
  departments = MOCK_DEPARTMENT_BUDGETS,
  defaultDepartmentId,
  step = 1,
  title = 'Real-time budget allocation',
  description = 'Drag an agent slider to reshape the department pool. Allocation is validated live against the pool ceiling.',
  className = '',
  onAllocationChange,
}: BudgetAllocationDashboardProps) {
  const pools = useMemo<DepartmentBudget[]>(
    () => (departments.length > 0 ? departments : []),
    [departments],
  );
  const department = useMemo(
    () => pools.find((pool) => pool.id === defaultDepartmentId) ?? pools[0],
    [pools, defaultDepartmentId],
  );

  const [selectedId, setSelectedId] = useState<string>(department?.id ?? '');
  const activeDepartment = useMemo(
    () => pools.find((pool) => pool.id === selectedId) ?? department,
    [pools, selectedId, department],
  );

  const [allocations, setAllocations] = useState<Record<string, number>>(() =>
    activeDepartment ? buildInitialAllocations(activeDepartment) : {},
  );
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  // Prop-driven department switch: reset state during render (React's
  // documented alternative to a `useEffect` reset) so no stale pool lingers.
  if (activeDepartment && activeDepartment.id !== selectedId) {
    setSelectedId(activeDepartment.id);
    setAllocations(buildInitialAllocations(activeDepartment));
  }

  const mounted = useMounted();
  const reduceMotion = useReducedMotion();
  const onChangeRef = useAllocationChangeCallback(onAllocationChange);

  const stepValue = Math.min(25, Math.max(0.25, step));
  const pool = activeDepartment?.totalLimit ?? 0;
  const asset = activeDepartment?.asset ?? 'USDC';
  const agents = useMemo(() => activeDepartment?.agents ?? [], [activeDepartment]);

  const rows = useMemo<AllocationRowInput[]>(
    () => agents.map((agent) => ({ id: agent.id, bps: allocations[agent.id] ?? 0 })),
    [agents, allocations],
  );

  const summary = useMemo(() => computeAllocationSummary(pool, rows), [pool, rows]);

  // Charts lag one frame behind the pointer so dragging stays at 60fps; the
  // numeric readouts beside the sliders always show the committed value.
  const deferredSummary = useDeferredValue(summary);

  const shareData = useMemo<ShareDatum[]>(() => {
    const slices = deferredSummary.rows.map((row, index) => {
      const agent = agents.find((item) => item.id === row.id);
      return {
        id: row.id,
        name: agent?.agentName ?? row.id,
        value: row.bps,
        color: sliceColor(index),
      };
    });
    if (deferredSummary.unallocatedBps > 0) {
      slices.push({
        id: 'unallocated',
        name: 'Unallocated',
        value: deferredSummary.unallocatedBps,
        color: UNALLOCATED_COLOR,
      });
    }
    return slices;
  }, [deferredSummary, agents]);

  const history = useMemo(
    () => (activeDepartment ? buildConsumptionHistory(activeDepartment) : []),
    [activeDepartment],
  );

  const handleSliderChange = useCallback((id: string, percent: number) => {
    const bps = percentToBps(percent);
    setAllocations((previous) =>
      previous[id] === bps ? previous : { ...previous, [id]: bps },
    );
  }, []);

  const applyPreset = useCallback(
    (preset: 'normalize' | 'even' | 'reset') => {
      if (!activeDepartment) return;
      setAllocations((previous) => {
        const current: AllocationRowInput[] = activeDepartment.agents.map((agent) => ({
          id: agent.id,
          bps: previous[agent.id] ?? 0,
        }));
        if (preset === 'reset') return buildInitialAllocations(activeDepartment);
        if (preset === 'even') {
          return evenSplit(current).reduce<Record<string, number>>((acc, row) => {
            acc[row.id] = row.bps;
            return acc;
          }, {});
        }
        return normalizeToPool(current).reduce<Record<string, number>>((acc, row) => {
          acc[row.id] = row.bps;
          return acc;
        }, {});
      });
    },
    [activeDepartment],
  );

  // Real-time notification for consumers (parents can debounce/persist it).
  useEffect(() => {
    if (!activeDepartment) return;
    onChangeRef.current?.({
      departmentId: activeDepartment.id,
      asset,
      pool,
      allocatedBps: summary.allocatedBps,
      allocatedAmount: summary.allocatedAmount,
      unallocatedBps: summary.unallocatedBps,
      unallocatedAmount: summary.unallocatedAmount,
      isOverAllocated: summary.isOverAllocated,
      rows: summary.rows,
    });
  }, [activeDepartment, asset, pool, summary, onChangeRef]);

  if (!activeDepartment) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <EmptyState
            title="No department pools"
            description="Create a department budget before allocating spend to agents."
          />
        </CardContent>
      </Card>
    );
  }

  const utilizationOfCap =
    activeDepartment.totalLimit > 0
      ? (activeDepartment.totalSpent / activeDepartment.totalLimit) * 100
      : 0;

  const stats = [
    {
      key: 'pool',
      label: 'Department pool',
      value: formatCurrency(pool, asset, { compact: true }),
      hint: `${activeDepartment.departmentCode} · ${activeDepartment.period}`,
      tone: 'text-foreground',
    },
    {
      key: 'allocated',
      label: 'Allocated to agents',
      value: formatCurrency(summary.allocatedAmount, asset, { compact: true }),
      hint: formatPercent(
        summary.allocatedPercent,
        summary.allocatedPercent % 1 === 0 ? 0 : 1,
      ),
      tone: summary.isOverAllocated ? 'text-danger' : 'text-foreground',
    },
    {
      key: 'unallocated',
      label: summary.isOverAllocated ? 'Over-allocation' : 'Unallocated budget',
      value: formatCurrency(
        summary.isOverAllocated ? summary.overAmount : summary.unallocatedAmount,
        asset,
        { compact: true },
      ),
      hint: summary.isOverAllocated
        ? `trim ${formatPercent(summary.overBps / 100, summary.overBps % 100 === 0 ? 0 : 1)} to rebalance`
        : `${formatPercent(summary.unallocatedPercent, summary.unallocatedBps % 100 === 0 ? 0 : 1)} still free`,
      tone: summary.isOverAllocated ? 'text-danger' : 'text-success',
    },
    {
      key: 'consumed',
      label: 'Consumed this period',
      value: formatCurrency(activeDepartment.totalSpent, asset, { compact: true }),
      hint: `${formatPercent(utilizationOfCap, 0)} of the pool`,
      tone: 'text-foreground',
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="border-b border-border bg-surface-primary/60 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-gold" aria-hidden />
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
                <Badge variant="outline" size="sm">
                  Real-time
                </Badge>
              </div>
              <CardDescription className="max-w-2xl text-xs">
                {description}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="budget-allocation-department"
                className="text-2xs font-medium text-foreground-secondary"
              >
                Department
              </label>
              <select
                id="budget-allocation-department"
                value={activeDepartment.id}
                onChange={(event) => setSelectedId(event.target.value)}
                className="py-1.5 rounded-button border border-border bg-surface px-3 text-xs font-medium text-foreground focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {pools.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.departmentName} ({item.departmentCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-2xs text-foreground-muted">
            <span className="gap-1.5 inline-flex items-center">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              {activeDepartment.managerName}
            </span>
            <span className="gap-1.5 inline-flex items-center">
              <Layers className="h-3.5 w-3.5" aria-hidden />
              {agents.length} agents
            </span>
            <span className="gap-1.5 inline-flex items-center">
              <Coins className="h-3.5 w-3.5" aria-hidden />
              {formatPercent(utilizationOfCap, 0)} consumed
            </span>
            <span>Updated {formatRelativeTime(activeDepartment.updatedAt)}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          {/* Live allocation summary — recalculated on every slider tick. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <motion.div
                key={stat.key}
                layout={!reduceMotion}
                className="rounded-card border border-border bg-surface-secondary/40 p-4"
              >
                <p className="text-2xs font-medium uppercase tracking-wide text-foreground-muted">
                  {stat.label}
                </p>
                <p
                  className={cn(
                    'tabular mt-1.5 font-display text-2xl font-semibold leading-none',
                    stat.tone,
                  )}
                >
                  {stat.value}
                </p>
                <p className="tabular mt-1.5 text-2xs text-foreground-secondary">
                  {stat.hint}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Unallocated readout + breach alert */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="rounded-card border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" aria-hidden />
                <p className="text-sm font-medium text-foreground">
                  Unallocated budget
                </p>
              </div>
              <p
                className={cn(
                  'tabular font-display text-xl font-semibold',
                  summary.isOverAllocated ? 'text-danger' : 'text-success',
                )}
              >
                {summary.isOverAllocated ? '−' : ''}
                {formatCurrency(
                  summary.isOverAllocated
                    ? summary.overAmount
                    : summary.unallocatedAmount,
                  asset,
                )}
                <span className="ml-2 text-xs font-normal text-foreground-muted">
                  {formatPercent(
                    Math.abs(summary.unallocatedPercent),
                    summary.unallocatedBps % 100 === 0 ? 0 : 1,
                  )}
                </span>
              </p>
            </div>

            <div
              className="h-2.5 mt-3 w-full overflow-hidden rounded-full bg-surface-secondary"
              role="progressbar"
              aria-label="Share of the department pool allocated to agents"
              aria-valuenow={Math.round(clampPercent(summary.allocatedPercent))}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-fast ease-astroid',
                  summary.isOverAllocated ? 'bg-danger' : 'bg-gold',
                )}
                style={{ width: `${clampPercent(summary.allocatedPercent)}%` }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-2xs text-foreground-muted">
              <span className="tabular">
                {formatCurrency(summary.allocatedAmount, asset)} allocated of{' '}
                {formatCurrency(pool, asset)}
              </span>
              <span className="tabular">
                {formatCurrency(activeDepartment.totalRemaining, asset)} left to spend
              </span>
            </div>
          </div>

          <AnimatePresence>
            {summary.isOverAllocated && (
              <motion.div
                key="breach"
                role="alert"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-3 rounded-card border border-danger/50 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <ShieldAlert
                    className="mt-0.5 h-5 w-5 shrink-0 text-danger"
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-semibold text-danger">
                      Allocation exceeds the department pool
                    </p>
                    <p className="mt-0.5 text-2xs text-foreground-secondary">
                      <span className="tabular">
                        {formatPercent(summary.allocatedPercent, 1)}
                      </span>{' '}
                      allocated — reduce agent caps by{' '}
                      <span className="tabular font-medium text-danger">
                        {formatCurrency(summary.overAmount, asset)}
                      </span>{' '}
                      to bring {activeDepartment.departmentCode} back inside{' '}
                      {formatCurrency(pool, asset)}.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => applyPreset('normalize')}
                  >
                    Rebalance to 100%
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preset actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyPreset('normalize')}
                disabled={rows.length === 0 || summary.allocatedBps === 0}
              >
                Normalize to 100%
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyPreset('even')}
                disabled={rows.length === 0}
              >
                Split evenly
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => applyPreset('reset')}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Reset
              </Button>
            </div>
            {!summary.isOverAllocated && (
              <p className="gap-1.5 inline-flex items-center text-2xs text-foreground-muted">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Arrow keys move a slider by {stepValue}%; Page Up/Down by 10%.
              </p>
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No agents in this department"
              description={`Add an agent to ${activeDepartment.departmentName} before shaping its allocation.`}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent, index) => {
                const row = summary.rows.find((item) => item.id === agent.id);
                return (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    index={index}
                    percent={row?.percent ?? 0}
                    amount={row?.amount ?? 0}
                    step={stepValue}
                    invalid={summary.isOverAllocated}
                    highlighted={activeAgentId === agent.id}
                    onChange={handleSliderChange}
                    onHover={setActiveAgentId}
                  />
                );
              })}
            </div>
          )}

          {/* Recharts breakdown */}
          <div className="grid gap-6 border-t border-border pt-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-gold" aria-hidden />
                <h3 className="font-display text-sm font-semibold">
                  Allocation shares
                </h3>
              </div>

              {mounted ? (
                <AllocationDonut
                  data={shareData}
                  asset={asset}
                  pool={pool}
                  allocatedPercent={deferredSummary.allocatedPercent}
                  isOverAllocated={deferredSummary.isOverAllocated}
                  activeId={activeAgentId}
                  onHover={setActiveAgentId}
                />
              ) : (
                <div className="skeleton h-[240px] w-full rounded-card" />
              )}

              <ul className="space-y-1.5">
                {shareData.map((datum) => (
                  <li
                    key={datum.id}
                    onMouseEnter={() => setActiveAgentId(datum.id)}
                    onMouseLeave={() => setActiveAgentId(null)}
                    className={cn(
                      'py-1.5 flex items-center justify-between gap-3 rounded-sm px-2 text-2xs transition-colors duration-fast',
                      activeAgentId === datum.id
                        ? 'bg-surface-secondary'
                        : 'bg-transparent',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: datum.color }}
                      />
                      <span className="truncate text-foreground">{datum.name}</span>
                    </span>
                    <span className="tabular shrink-0 text-foreground-secondary">
                      {formatPercent(
                        datum.value / 100,
                        datum.value % 100 === 0 ? 0 : 1,
                      )}
                      <span className="ml-2 text-foreground-muted">
                        {formatCurrency(bpsToAmount(pool, datum.value), asset, {
                          compact: true,
                        })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gold" aria-hidden />
                  <h3 className="font-display text-sm font-semibold">
                    14-day consumption trend
                  </h3>
                </div>
                <span className="inline-flex items-center gap-2 text-2xs text-foreground-muted">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-gold" aria-hidden />
                    Spend
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-0.5 h-2 bg-danger" aria-hidden />
                    Cap
                  </span>
                </span>
              </div>

              {mounted ? (
                <ConsumptionTrend
                  history={history}
                  cap={summary.allocatedAmount}
                  asset={asset}
                />
              ) : (
                <div className="skeleton h-[240px] w-full rounded-card" />
              )}

              <p className="text-2xs text-foreground-muted">
                The dashed cap line tracks the live allocation total, so reshaping the
                sliders moves the headroom instantly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </MotionConfig>
  );
}

export default BudgetAllocationDashboard;

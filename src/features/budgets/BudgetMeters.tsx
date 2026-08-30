'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CircleDollarSign, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

export interface BudgetMeterProps {
  label: string;
  allocated: number;
  spent: number;
  currency?: string;
  percent?: number;
}

export type BudgetMeterState = 'normal' | 'warning' | 'critical';

export function getBudgetMeterState(percent: number): BudgetMeterState {
  if (percent >= 100) return 'critical';
  if (percent >= 70) return 'warning';
  return 'normal';
}

function Gauge({ percent = 0, label, spent, allocated, currency }: BudgetMeterProps) {
  const safePercent = Math.min(100, Math.max(0, percent));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safePercent / 100) * circumference;
  const state = getBudgetMeterState(safePercent);

  const colors: Record<BudgetMeterState, { track: string; stroke: string; ring: string }> = {
    normal: {
      track: 'stroke-slate-700/60',
      stroke: '#34d399',
      ring: 'bg-emerald-500/10 text-emerald-300',
    },
    warning: {
      track: 'stroke-slate-700/60',
      stroke: '#f59e0b',
      ring: 'bg-amber-500/10 text-amber-300',
    },
    critical: {
      track: 'stroke-slate-700/60',
      stroke: '#f87171',
      ring: 'bg-rose-500/10 text-rose-300',
    },
  };

  const tone = colors[state];

  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-surface-secondary/40 p-4">
      <div className="relative grid h-24 w-24 place-items-center">
        <svg viewBox="0 0 140 140" className="h-24 w-24 -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            className={tone.track}
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={tone.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={state === 'critical' ? 'animate-pulse' : ''}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-foreground-muted">
              {safePercent.toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{label}</p>
            <p className="text-2xs text-foreground-muted">Allocated spend envelope</p>
          </div>
          <Badge
            variant={state === 'critical' ? 'danger' : state === 'warning' ? 'warning' : 'success'}
            size="sm"
            dot
          >
            {state === 'critical' ? 'Critical' : state === 'warning' ? 'Watch' : 'Healthy'}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-foreground-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" aria-hidden />
            {formatCurrency(spent, currency, { compact: true })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
            {formatCurrency(allocated, currency, { compact: true })}
          </span>
        </div>

        <div className="flex items-center gap-2 text-2xs text-foreground-muted">
          <span className={`inline-flex rounded-full px-2 py-1 ${tone.ring}`}>
            {state === 'critical' ? 'Over-allocated' : state === 'warning' ? 'Elevated usage' : 'Within limit'}
          </span>
          {state === 'critical' && (
            <span className="inline-flex items-center gap-1 text-danger">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Action required
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function BudgetMeters({
  budgets,
}: {
  budgets?: BudgetMeterProps[];
}) {
  const baseBudgets = useMemo<BudgetMeterProps[]>(
    () =>
      budgets ?? [
        { label: 'Treasury reserve', allocated: 120000, spent: 86000, currency: 'USDC' },
        { label: 'Operations', allocated: 78000, spent: 45200, currency: 'USDC' },
        { label: 'Growth programs', allocated: 95000, spent: 93000, currency: 'USDC' },
      ],
    [budgets],
  );

  const [values, setValues] = useState<number[]>(baseBudgets.map((budget) => (budget.allocated > 0 ? (budget.spent / budget.allocated) * 100 : 0)));

  useEffect(() => {
    const nextValues = baseBudgets.map((budget) => (budget.allocated > 0 ? (budget.spent / budget.allocated) * 100 : 0));
    setValues(nextValues);
  }, [baseBudgets]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {baseBudgets.map((budget, index) => (
        <Gauge
          key={`${budget.label}-${index}`}
          label={budget.label}
          allocated={budget.allocated}
          spent={budget.spent}
          currency={budget.currency ?? 'USDC'}
          percent={values[index] ?? 0}
        />
      ))}
    </div>
  );
}

export function BudgetMeterCard({ budgets }: { budgets?: BudgetMeterProps[] }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
              Budget consumption
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold">Live envelope usage</h3>
          </div>
          <Badge variant="outline" size="sm">
            Real-time
          </Badge>
        </div>
        <BudgetMeters budgets={budgets} />
      </CardContent>
    </Card>
  );
}

export default BudgetMeterCard;

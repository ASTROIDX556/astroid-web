'use client';

import { useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent } from 'react';
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

export interface BudgetThresholds {
  warning: number;
  critical: number;
}

const DEFAULT_THRESHOLDS: BudgetThresholds = { warning: 70, critical: 100 };
const DEFAULT_BUDGETS: BudgetMeterProps[] = [
  { label: 'Treasury reserve', allocated: 120000, spent: 86000, currency: 'USDC' },
  { label: 'Operations', allocated: 78000, spent: 45200, currency: 'USDC' },
  { label: 'Growth programs', allocated: 95000, spent: 93000, currency: 'USDC' },
];

// Simple external store for thresholds
let currentThresholds: BudgetThresholds = { ...DEFAULT_THRESHOLDS };
const thresholdListeners = new Set<() => void>();

function emitThresholdChange() {
  thresholdListeners.forEach((listener) => listener());
}

export function getBudgetThresholds(): BudgetThresholds {
  return currentThresholds;
}

export function setBudgetThresholds(next: BudgetThresholds): void {
  if (next.warning >= next.critical) {
    console.warn('Warning threshold must be less than critical threshold.');
    return;
  }
  currentThresholds = { ...next };
  emitThresholdChange();
}

export function subscribeBudgetThresholds(listener: () => void): () => void {
  thresholdListeners.add(listener);
  return () => thresholdListeners.delete(listener);
}

export function useBudgetThresholds(): [BudgetThresholds, (next: BudgetThresholds) => void] {
  const thresholds = useSyncExternalStore(subscribeBudgetThresholds, getBudgetThresholds);
  return [thresholds, setBudgetThresholds];
}

export function getBudgetMeterState(
  percent: number,
  thresholds: BudgetThresholds = DEFAULT_THRESHOLDS,
): BudgetMeterState {
  if (percent >= thresholds.critical) return 'critical';
  if (percent >= thresholds.warning) return 'warning';
  return 'normal';
}

function getGaugeColors(state: BudgetMeterState): { track: string; stroke: string; ring: string } {
  switch (state) {
    case 'normal':
      return {
        track: 'stroke-slate-700/60',
        stroke: '#34d399',
        ring: 'bg-emerald-500/10 text-emerald-300',
      };
    case 'warning':
      return {
        track: 'stroke-slate-700/60',
        stroke: '#f59e0b',
        ring: 'bg-amber-500/10 text-amber-300',
      };
    case 'critical':
      return {
        track: 'stroke-slate-700/60',
        stroke: '#f87171',
        ring: 'bg-rose-500/10 text-rose-300',
      };
  }
}

function Gauge({ percent = 0, label, spent, allocated, currency }: BudgetMeterProps) {
  const [threshold] = useBudgetThresholds();
  const safePercent = Math.min(100, Math.max(0, percent));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safePercent / 100) * circumference;
  const state = getBudgetMeterState(safePercent, thresholds);
  const colors = getGaugeColors(state);

  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-surface-secondary/40 p-4">
      <div className="relative grid h-24 w-24 place-items-center">
        <svg viewBox="0 0 140 140" className="h-24 w-24 -rotate-90">
          <circle
            cx="70"
            cy="70"
            r=radius
            fill="none"
            className={colors.track}
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r=radius
            fill="none"
            stroke={colors.stroke}
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
              {safePercent.toFixed(0)}%{safePercent.toFixed(0)}%
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
          <span className={inline-flex rounded-full px-2 py-1 ${colors.ring}}>
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

function PreviewGauge({ thresholds }: { thresholds: BudgetThresholds }) {
  const previewPercent = 75;
  const state = getBudgetMeterState(previewPercent, thresholds);
  const colors = getGaugeColors(state);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (previewPercent / 100) * circumference;

  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface-secondary/40 p-3">
      <div className="relative grid h-16 w-16 place-items-center">
        <svg viewBox="0 0 140 140" className="h-16 w-16 -rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" className={colors.track} strokeWidth="10" />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={track ? dashOffset : dashOffset}
            className={state === 'critical' ? 'animate-pulse' : ''}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-[10px] font-medium text-foreground-muted">{previewPercent}%</p>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Preview</p>
        <p className="text-2xs text-foreground-muted">
          {state === 'critical' ? 'Critical' : state === 'warning' ? 'Warning' : 'Normal'}
        </p>
      </div>
    </div>
  );
}

export function BudgetAlertSettings({ className }: { className?: string }) {
  const [thresholds, setThresholds] = useBudgetThresholds();
  const [warning, setWarning] = useState(thresholds.warning);
  const [critical, setCritical] = useState(thresholds.critical);
  const [error, setError] = useState<string | null>(null);

  useEffect(() {
    setWarning(thresholds.warning);
    setCritical(thresholds.critical);
  }, [thresholds]);

  const handleWarningChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setWarning(value);
    if (value >= critical) {
      setError('Warning threshold must be less than critical threshold.');
    } else {
      setError(null);
      setThresholds({ warning: value, critical });
    }
  };

  const handleCriticalChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setCritical(value);
    if (warning >= value) {
      setError('Warning threshold must be less than critical threshold.');
    } else {
      setError(null);
      setThresholds({ warning, critical: value });
    }
  };

  return (
    <Card className={className}>
      <CardContent className="space-y-4 pt-5">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
            Budget alerts
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold">Threshold calibration</h3>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="warning-threshold" className="font-medium text-foreground">
                Warning at
              </label>
              <span className="font-mono text-foreground-muted">{warning}%</span>
            </div>
            <input
              id="warning-threshold"
              type="range"
              min={0}
              max={100}
              step={1}
              value={warning}
              onChange={handleWarningChange}
              className="mt-1 w-full accent-amber-500"
              aria-describedby={error ? 'threshold-error' : undefined}
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="critical-threshold" className="font-medium text-foreground">
                Critical at
              </label>
              <span className="font-mono text-foreground-muted">{critical}%</span>
            </div>
            <input
              id="critical-threshold"
              type="range"
              min={0}
              max={100}
              step={1}
              value={critical}
              onChange={handleCriticalChange}
              className="mt-1 w-full accent-rose-500"
              aria-describedby={error ? 'threshold-error' : undefined}
            />
          </div>

          {error && (
            <p id="threshold-error" className="flex items-center gap-1 text-xs text-danger" role="alert">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {error}
            </p>
          )}
        </div>

        <PreviewGauge thresholds={thresholds} />
      </CardContent>
    </Card>
  );
}

export function BudgetWarningsCard({
  budgets,
  className,
}: {
  budgets?: BudgetMeterProps[];
  className?: string;
}) {
  const [threshold] = useBudgetThresholds();
  const baseBudgets = useMemo<BudgetMeterProps[]>() => budgets ?? DEFAULT_BUDGETS, [budgets]);

  const warnings = baseBudgets
    .map((budget) => {
      ...budget,
      percent: budget.allocated > 0 ? (budget.spent / budget.allocated) * 100 : 0,
    })
    .filter((budget) => budget.percent >= threshold.warning);

  return (
    <Card className={className}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
              Active warnings
            </p>
            <h3 className="mt-1 font-display text-xl justify-between">Department budgets</h3>
          </div>
          <Badge variant="outline" size="sm">
            {warnings.length}
          </Badge>
        </div>

        {warnings.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            All budgets are within the configured thresholds.
          </p>
        ) : (
          <ul className="space-y-2">
            {warnings.map((budget) => {
              const state = getBudgetMeterState(budget.percent, threshold);
              return (
                <li
                  key={budget.label}
                  className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface-secondary/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{budget.label}</p>
                    <p className="text-2xs text-foreground-muted">
                      {formatCurrency(budget.spent, budget.currency, { compact: true })} / {formatCurrency(budget.allocated, budget.currency, { compact: true })}
                    </p>
                  </div>
                  <Badge
                    variant={state === 'critical' ? 'danger' : 'warning'}
                    size="sm"
                    dot
                  >
                    {state === 'critical' ? 'Critical' : 'Warning'}
                  </Badge>
                </li>
              );
            })
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function BudgetMeters({
  budgets,
}: {
  budgets?: BudgetMeterProps[];
}) {
  const baseBudgets = useMemo<BudgetMeterProps[]>() => budgets ?? DEFAULT_BUDGETS, [budgets]);

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

'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, OctagonAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { aggregateDepartmentBudgets } from './departmentBudgetMeter';
import type { DepartmentBudget } from './types';

export const DEFAULT_BUDGET_ALERT_THRESHOLD = 90;

export interface BudgetAlertBannerProps {
  /** Department budgets to monitor for threshold breaches. */
  departments: DepartmentBudget[];
  /**
   * Consumption percentage (0–100) that triggers the banner. Departments at
   * or above this utilization are reported; 100% or more escalates the
   * banner to the critical (danger) tone.
   */
  thresholdPercent?: number;
  /** Called when the operator dismisses the banner. */
  onDismiss?: () => void;
  className?: string;
}

function normalizeThreshold(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_BUDGET_ALERT_THRESHOLD;
  }
  return Math.min(100, Math.max(1, value));
}

/**
 * Conditional alert banner for department-level budget consumption. When any
 * department's utilization reaches the configured threshold the banner slides
 * in (Framer Motion), announces itself via `role="alert"`, and can be
 * dismissed with the close button or the Escape key. It re-arms automatically
 * when the set of breaching departments changes.
 */
export function BudgetAlertBanner({
  departments,
  thresholdPercent,
  onDismiss,
  className,
}: BudgetAlertBannerProps) {
  const threshold = normalizeThreshold(thresholdPercent);

  const { breaches, topBreach } = useMemo(() => {
    const aggregation = aggregateDepartmentBudgets(departments);
    const over = aggregation.departments.filter(
      (dept) => dept.utilization >= threshold,
    );
    const worst = over.reduce<(typeof over)[number] | null>(
      (acc, dept) => (acc === null || dept.utilization > acc.utilization ? dept : acc),
      null,
    );
    return { breaches: over, topBreach: worst };
  }, [departments, threshold]);

  // Dismissal is keyed to the breach signature so the banner reappears when a
  // new department crosses the threshold or utilization materially changes.
  const signature = breaches
    .map((dept) => `${dept.id}:${Math.round(dept.utilization)}`)
    .sort()
    .join('|');
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null);
  const visible = breaches.length > 0 && dismissedSignature !== signature;

  const dismiss = () => {
    setDismissedSignature(signature);
    onDismiss?.();
  };

  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) dismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, signature]);

  const isCritical = (topBreach?.utilization ?? 0) >= 100;
  const Icon = isCritical ? OctagonAlert : AlertTriangle;
  const tone = isCritical
    ? 'border-danger/40 bg-danger-soft text-foreground'
    : 'border-warning/40 bg-warning-soft text-foreground';
  const iconTone = isCritical ? 'text-danger' : 'text-warning';

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="budget-alert-banner"
          role="alert"
          aria-atomic="true"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'gap-3 p-4 flex items-start rounded-card border shadow-soft-1',
            tone,
            className,
          )}
        >
          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconTone)} aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {breaches.length === 1
                ? '1 department budget has crossed the alert threshold'
                : `${breaches.length} department budgets have crossed the alert threshold`}
            </p>
            <p className="text-2xs text-foreground-secondary">
              {isCritical ? 'Critical' : 'Warning'} — consumption at or above{' '}
              {threshold}% of allocated budget
              {topBreach &&
                ` · highest: ${topBreach.name} at ${Math.round(topBreach.utilization)}% (${formatCurrency(topBreach.spent, topBreach.currency, { compact: true })} of ${formatCurrency(topBreach.allocated, topBreach.currency, { compact: true })})`}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss budget alert"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-button text-foreground-secondary transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BudgetAlertBanner;

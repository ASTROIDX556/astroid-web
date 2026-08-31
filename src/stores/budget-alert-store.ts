'use client';

import { useSyncExternalStore } from 'react';

export interface BudgetAlertThresholds {
  warning: number;
  critical: number;
}

export type BudgetAlertLevel = 'ok' | 'warning' | 'critical';

const DEFAULTTHRESHOLDS: BudgetAlertThresholds = { warning: 80, critical: 95 };

let thresholds: BudgetAlertThresholds = { ...DEFAULTTHRESHOLDS };
let validationError: string | null = null;
let snapshot = { thresholds, validationError };

const listeners = new Set<() => void>();

function emit() {
  snapshot = { thresholds, validationError };
  listeners.forEach((listener) => listener());
}

export function setBudgetAlertThresholds(next: BudgetAlertThresholds) {
  const warning = Math.min(100, Math.max(0, Math.round(next.warning)));
  const critical = Math.min(100, Math.max(0, Math.round(next.critical)));
  const invalid = warning >= critical;
  const nextThresholds = invalid ? thresholds : { warning, critical };
  const nextValidationError = invalid
    ? 'Warning threshold must be strictly less than critical threshold.'
    : null;

  if (nextThresholds === thresholds && nextValidationError === validationError) {
    return;
  }

  thresholds = nextThresholds;
  validationError = nextValidationError;

  if (invalid) {
    console.warn(validationError);
  }

  emit();
}

export function getBudgetAlertLevel(utilization: number): BudgetAlertLevel {
  if (utilization >= thresholds.critical) return 'critical';
  if (utilization >= thresholds.warning) return 'warning';
  return 'ok';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

export function useBudgetAlertThresholds() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export { DEFAULTTHRESHOLDS };

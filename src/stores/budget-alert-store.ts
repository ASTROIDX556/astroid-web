'use client';

import { useSyncExternalStore } from 'react';

export interface BudgetAlertThresholds {
  warning: number;
  critical: number;
}

const DEFAULTHRESHOLDS = { warning: 80, critical: 95 };

let thresholds: BudgetAlertThresholds = DEFAULT_THRESHOLDS;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setBudgetAlertThresholds(next: BudgetAlertThresholds) {
  const warning = Math.min(100, Math.max(0, Math.round(next.warning)));
  const critical = Math.min(100, Math.max(0, Math.round(next.critical)));
  if (warning >= critical) {
    console.warn('Warning threshold must be strictly less than critical threshold.');
    return;
  }
  thresholds = { warning, critical };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return thresholds;
}

export function useBudgetAlertThresholds() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export { DEFAULTHRESHOLDS };
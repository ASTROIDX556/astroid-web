export type BudgetConsumptionState =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'exceeded';

export interface BudgetConsumptionResult {
  percent: number;
  remaining: number;
  state: BudgetConsumptionState;
}

export function normalizeThreshold(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, value));
}

export function calculateConsumptionPercent(spent: number, allocated: number): number {
  if (!Number.isFinite(spent) || spent < 0) return 0;
  if (!Number.isFinite(allocated) || allocated <= 0) return 0;
  return (spent / allocated) * 100;
}

export function classifyBudgetConsumption(
  spent: number,
  allocated: number,
  warningThreshold = 80,
  criticalThreshold = 95,
): BudgetConsumptionResult {
  const warning = normalizeThreshold(warningThreshold, 80);
  const critical = normalizeThreshold(criticalThreshold, 95);
  const effectiveWarning = Math.min(warning, critical);
  const effectiveCritical = Math.max(warning, critical);
  const safeAllocated = Number.isFinite(allocated) && allocated > 0 ? allocated : 0;
  const safeSpent = Number.isFinite(spent) && spent > 0 ? spent : 0;
  const percent = calculateConsumptionPercent(safeSpent, safeAllocated);
  const remaining = Math.max(0, safeAllocated - safeSpent);

  let state: BudgetConsumptionState = 'healthy';
  if (percent > 100) state = 'exceeded';
  else if (percent >= effectiveCritical) state = 'critical';
  else if (percent >= effectiveWarning) state = 'warning';

  return { percent, remaining, state };
}

/**
 * Pure derivations for the department expense-breakdown drill-down (#247).
 *
 * The drill-down view renders historical spend as a Recharts time series, but
 * the bucketing/aggregate logic is kept here (no React, no charting) so the
 * component stays presentational and the rules — daily buckets for short
 * windows, weekly buckets beyond that, bounded bucket count — are easy to
 * reason about and reuse across the meter drill-down and the budget detail
 * view.
 */
import type { DepartmentBudget } from '../types';

/** One spend observation feeding the series builder. */
export interface ExpenseBreakdownInput {
  date: string;
  amount: number;
  counterparty?: string;
  description?: string;
}

/** One rendered point of the expense time series. */
export interface ExpenseSeriesPoint {
  /** Human bucket label, e.g. `Aug 12` or `Aug 12–18`. */
  bucketLabel: string;
  /** Epoch millis of the bucket start (drives ordering). */
  periodStart: number;
  /** Sum of spend inside the bucket. */
  spent: number;
  /** Running total across ordered buckets. */
  cumulative: number;
  /** Number of expense events inside the bucket. */
  entries: number;
}

/** Per-agent totals for the drill-down ledger rail. */
export interface AgentSpendRow {
  agentId: string;
  agentName: string;
  spent: number;
  allocated: number;
  asset: string;
}

/** Windows of ten days or shorter render as daily buckets; longer as weekly. */
const DAILY_WINDOW_DAYS = 10;
const DAY_MS = 86_400_000;

const DAY_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function startOfDay(value: number): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(value: number): number {
  const day = startOfDay(value);
  const weekday = new Date(day).getDay(); // 0 = Sunday
  return day - weekday * DAY_MS;
}

/**
 * Flatten a department's agent ledgers into chart inputs, newest-first safe
 * (the series builder sorts regardless of input order). Agents without a
 * recorded ledger contribute nothing here — the zero-spend state is handled by
 * the empty result, not fabricated data.
 */
export function toExpenseInputs(department: DepartmentBudget): ExpenseBreakdownInput[] {
  return department.agents.flatMap((agent) =>
    (agent.ledger ?? []).map((entry) => ({
      date: entry.date,
      amount: entry.amount,
      counterparty: entry.counterparty,
      description: entry.description,
    })),
  );
}

/**
 * Bucket raw spend events into an ordered, cumulative series. Daily buckets
 * when the observed window is ≤ 10 days, weekly buckets otherwise, capped at
 * `maxBuckets` (oldest events fold into the first retained bucket so totals
 * still reconcile).
 */
export function buildExpenseSeries(
  inputs: ExpenseBreakdownInput[],
  maxBuckets = 12,
): ExpenseSeriesPoint[] {
  const events = inputs
    .filter((input) => Number.isFinite(input.amount) && !Number.isNaN(new Date(input.date).getTime()))
    .map((input) => ({ time: new Date(input.date).getTime(), amount: input.amount }))
    .sort((a, b) => a.time - b.time);

  if (events.length === 0) return [];

  const oldest = events[0];
  const newest = events[events.length - 1];
  if (!oldest || !newest) return [];

  const spanDays = (newest.time - oldest.time) / DAY_MS + 1;
  const bucketStart = spanDays <= DAILY_WINDOW_DAYS ? startOfDay : startOfWeek;

  const ordered = new Map<number, { spent: number; entries: number }>();

  for (const event of events) {
    const start = bucketStart(event.time);
    const row = ordered.get(start) ?? { spent: 0, entries: 0 };
    row.spent += event.amount;
    row.entries += 1;
    ordered.set(start, row);
  }

  const sortedStarts = [...ordered.keys()].sort((a, b) => a - b);
  const dropCount = Math.max(0, sortedStarts.length - maxBuckets);
  const dropped = sortedStarts.slice(0, dropCount);
  const retained = sortedStarts.slice(dropCount);

  // Events older than the retained window fold into the oldest retained
  // bucket so the series totals still reconcile with the department spend.
  if (dropped.length > 0 && retained.length > 0) {
    const targetStart = retained[0];
    if (targetStart != null) {
      const target = ordered.get(targetStart) ?? { spent: 0, entries: 0 };
      for (const start of dropped) {
        const row = ordered.get(start);
        if (!row) continue;
        target.spent += row.spent;
        target.entries += row.entries;
        ordered.delete(start);
      }
      ordered.set(targetStart, target);
    }
  }

  // Folds merge into the oldest retained bucket, so cumulative over the
  // retained tail equals the full total.
  let acc = 0;
  return retained.map((start) => {
    const row = ordered.get(start) ?? { spent: 0, entries: 0 };
    acc += row.spent;
    const end = start + (bucketStart === startOfWeek ? 7 : 1) * DAY_MS - 1;
    return {
      bucketLabel:
        bucketStart === startOfWeek
          ? `${DAY_LABEL.format(start)}–${DAY_LABEL.format(end)}`
          : DAY_LABEL.format(start),
      periodStart: start,
      spent: Math.round(row.spent * 100) / 100,
      cumulative: Math.round(acc * 100) / 100,
      entries: row.entries,
    };
  });
}

/** Agent spend rows for the drill-down rail, sorted by spent descending. */
export function departmentAgentRows(department: DepartmentBudget): AgentSpendRow[] {
  return department.agents
    .map((agent) => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      spent: agent.spentAmount,
      allocated: agent.allocatedAmount,
      asset: agent.asset,
    }))
    .sort((a, b) => b.spent - a.spent);
}

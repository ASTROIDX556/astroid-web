'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  ArrowRight,
  FileCode2,
  ListChecks,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { truncateHash } from '@/lib/format';
import type { PolicyRule } from '@/features/policies/usePolicySimulation';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type SimulatedOpStatus = 'allowed' | 'blocked';

export interface SimulatedOperation {
  /** Operation type, e.g. "Payment". */
  type: string;
  asset: string;
  amount: string;
  /** Recipient, counterparty or source descriptor for the operation. */
  source: string;
  status: SimulatedOpStatus;
  /** IDs of rules that blocked (or flagged) this operation, empty when allowed. */
  triggeredRuleIds: string[];
}

export type SimulatedRuleStatus = 'matched' | 'violated' | 'not_triggered';

export interface SimulatedRuleOutcome {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  /** Rule constraint text, e.g. "Reject transfers above $25,000." */
  constraint: string;
  status: SimulatedRuleStatus;
  /** Human explanation of why the rule matched or failed. */
  detail: string;
}

export interface PolicySimulationDiffResult {
  passed: boolean;
  /** "auto_execute" | "requires_approval" | "blocked" — mirrors the API contract. */
  outcome: 'auto_execute' | 'requires_approval' | 'blocked';
  operations: SimulatedOperation[];
  rules: SimulatedRuleOutcome[];
}

export interface PolicySimulationDiffProps {
  /** Live evaluation result produced by `usePolicySimulation` / `evaluatePolicySimulation`. */
  result: PolicySimulationDiffResult;
  /** Rules that were evaluated, rendered in the diff columns. */
  rules: PolicyRule[];
  /** Short identifier of the simulated transaction (hash or id). */
  transactionId?: string;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Static configuration                                                        */
/* -------------------------------------------------------------------------- */

const OUTCOME_CONFIG = {
  auto_execute: {
    label: 'Auto-execute',
    badgeVariant: 'success' as const,
    statusIcon: CheckCircle2,
    statusClass: 'text-success',
    bg: 'bg-success-soft/40',
    border: 'border-success/30',
  },
  requires_approval: {
    label: 'Requires approval',
    badgeVariant: 'warning' as const,
    statusIcon: AlertTriangle,
    statusClass: 'text-warning',
    bg: 'bg-warning-soft/40',
    border: 'border-warning/30',
  },
  blocked: {
    label: 'Blocked',
    badgeVariant: 'danger' as const,
    statusIcon: XCircle,
    statusClass: 'text-danger',
    bg: 'bg-danger-soft/40',
    border: 'border-danger/30',
  },
};

/** Fold long JSON payloads for display while keeping them selectable. */
function foldPayload(value: string, maxLineLength = 72): string[] {
  if (value.length <= maxLineLength) return [value];
  const lines: string[] = [];
  for (let i = 0; i < value.length; i += maxLineLength) {
    lines.push(value.slice(i, i + maxLineLength));
  }
  return lines;
}
void foldPayload;

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Side-by-side diff of a simulated transaction against the policy engine:
 * the left column walks the proposed operations, the right column shows which
 * policy rules matched or failed, with semantic pass/fail badges throughout.
 */
export function PolicySimulationDiff({ result, rules, transactionId, className }: PolicySimulationDiffProps) {
  const outcome = OUTCOME_CONFIG[result.outcome];

  const blockedCount = useMemo(
    () => result.operations.filter((op) => op.status === 'blocked').length,
    [result.operations],
  );
  const violatedRules = useMemo(
    () => result.rules.filter((r) => r.status === 'violated'),
    [result.rules],
  );

  const announcement = result.passed
    ? `Simulation passed. ${result.rules.length} rules evaluated, no violations. Predicted outcome: ${outcome.label}.`
    : `Simulation failed. ${violatedRules.length} rule violation${violatedRules.length === 1 ? '' : 's'} detected across ${result.operations.length} operation${result.operations.length === 1 ? '' : 's'}. Predicted outcome: ${outcome.label}.`;

  return (
    <div className={cn('space-y-5', className)}>
      {/* Screen reader announcement of the simulation outcome ---------------- */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Outcome banner ----------------------------------------------------- */}
      <div
        className={cn(
          'flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center',
          outcome.bg,
          outcome.border,
        )}
      >
        <outcome.statusIcon className={cn('h-5 w-5 shrink-0', outcome.statusClass)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-semibold', outcome.statusClass)}>
            Simulation {result.passed ? 'passed' : 'failed'}
          </p>
          <p className="text-xs text-foreground-secondary">
            {result.operations.length} operation{result.operations.length === 1 ? '' : 's'} ·{' '}
            {blockedCount > 0
              ? `${blockedCount} blocked path${blockedCount === 1 ? '' : 's'}`
              : 'no blocked paths'}{' '}
            · {violatedRules.length} rule violation{violatedRules.length === 1 ? '' : 's'}
            {transactionId ? ` · ${truncateHash(transactionId, 6, 6)}` : ''}
          </p>
        </div>
        <Badge variant={outcome.badgeVariant} dot size="md">
          {outcome.label}
        </Badge>
      </div>

      {/* Diff columns ------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Proposed path ---------------------------------------------------- */}
        <section
          aria-labelledby="policy-diff-proposed-heading"
          className="rounded-card border border-border bg-surface"
        >
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3
              id="policy-diff-proposed-heading"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-secondary"
            >
              <FileCode2 className="h-3.5 w-3.5 text-gold" aria-hidden />
              Proposed path
            </h3>
            <Badge variant="outline" size="sm">
              {result.operations.length} op{result.operations.length === 1 ? '' : 's'}
            </Badge>
          </header>

          <ul className="divide-y divide-border">
            {result.operations.map((op, index) => (
              <li key={`${op.type}-${index}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{op.type}</p>
                    <p className="mt-0.5 truncate font-mono text-2xs text-foreground-muted" title={op.source}>
                      {truncateHash(op.source, 6, 8)}
                    </p>
                  </div>
                  <Badge variant={op.status === 'allowed' ? 'success' : 'danger'} size="sm">
                    {op.status === 'allowed' ? 'Allowed' : 'Blocked'}
                  </Badge>
                </div>
                <p className="mt-1.5 tabular text-xs text-foreground-secondary">
                  {op.asset} {op.amount}
                </p>
                {op.triggeredRuleIds.length > 0 && (
                  <p className="mt-1 inline-flex flex-wrap items-center gap-1 text-2xs text-danger">
                    <XCircle className="h-3 w-3" aria-hidden />
                    Triggered: {op.triggeredRuleIds.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Permitted path / rule outcomes ----------------------------------- */}
        <section
          aria-labelledby="policy-diff-rules-heading"
          className="rounded-card border border-border bg-surface"
        >
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3
              id="policy-diff-rules-heading"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-secondary"
            >
              <ListChecks className="h-3.5 w-3.5 text-gold" aria-hidden />
              Policy evaluation
            </h3>
            <Badge variant="outline" size="sm">
              {rules.length} rule{rules.length === 1 ? '' : 's'}
            </Badge>
          </header>

          <ul className="divide-y divide-border">
            {result.rules.map((rule) => (
              <li key={rule.ruleId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground" title={rule.ruleName}>
                      {rule.ruleName}
                    </p>
                    <p className="mt-0.5 text-2xs text-foreground-secondary">{rule.constraint}</p>
                  </div>
                  <Badge
                    variant={
                      rule.status === 'matched' ? 'success' : rule.status === 'violated' ? 'danger' : 'neutral'
                    }
                    size="sm"
                  >
                    {rule.status === 'matched' ? 'Matched' : rule.status === 'violated' ? 'Violated' : 'Not triggered'}
                  </Badge>
                </div>
                <p className="mt-1 text-2xs leading-relaxed text-foreground-muted">{rule.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Verdict ------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-4 py-3 text-xs">
        <Shield className="h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span className="text-foreground-secondary">
          {result.passed ? 'All policy checks passed — the transaction may proceed.' : 'Policy violations must be resolved before this transaction can be authorized.'}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 text-foreground-muted" aria-hidden />
        <span className={cn('font-semibold', outcome.statusClass)}>{outcome.label}</span>
      </div>
    </div>
  );
}

/**
 * Animated wrapper that plays the diff in with framer-motion when a simulation
 * finishes. Kept separate so the diff itself stays a pure, testable component.
 */
export function PolicySimulationDiffAnimated({
  resultKey,
  children,
}: {
  resultKey: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={resultKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default PolicySimulationDiff;

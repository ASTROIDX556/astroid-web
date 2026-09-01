import type { AssetSymbol } from './types';
import type { PolicyRule, RuleAction, RuleField, RuleOperator } from './rulesSchema';

/**
 * Policy simulation sandbox — pure evaluation helpers.
 *
 * Dry-runs a proposed agent transaction against a list of {@link PolicyRule}
 * clauses (the same Zod-validated shape produced by `rulesSchema.ts`) and
 * returns a verdict (`allowed` | `flagged` | `rejected`) together with a
 * step-by-step evaluation breakdown for display in the sandbox modal.
 *
 * This module is intentionally free of React/DOM dependencies so it can be
 * unit-tested and later reused by server-side policy previews.
 */

export type SimulationVerdict = 'allowed' | 'flagged' | 'rejected';

export type ClauseOutcome = 'pass' | 'matched' | 'skipped';

/** Proposed transaction under test. */
export interface SimulationTransaction {
  /** Amount in the asset's smallest display unit (e.g. XLM, USDC). */
  amount: number;
  asset: AssetSymbol;
  /** Stellar destination public key (G...). */
  recipient: string;
  /** Free-form agent tags used by `Destination Target` contains-rules. */
  agentTags: string[];
}

/** A single evaluated clause in the ordered breakdown. */
export interface EvaluatedClause {
  index: number;
  rule: PolicyRule;
  outcome: ClauseOutcome;
  /** Human-readable explanation of what the engine decided and why. */
  detail: string;
}

export interface PolicySimulationOutput {
  verdict: SimulationVerdict;
  /** Short human-readable summary of the verdict. */
  summary: string;
  /** Ordered per-clause breakdown, in rule evaluation order. */
  clauses: EvaluatedClause[];
  /** Indices into `clauses` whose action fired on this transaction. */
  matchedClauseIndices: number[];
}

/** Whitelist entries are comma-separated in rule values, mirroring the builder UI. */
function parseWhitelist(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function caseInsensitiveEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Evaluate a single comparison; `undefined` means "operator did not match". */
function compareValues(actual: string, operator: RuleOperator, expected: string): boolean {
  switch (operator) {
    case 'equals':
      return caseInsensitiveEquals(actual, expected);
    case 'contains':
      return actual.toLowerCase().includes(expected.trim().toLowerCase());
    case 'in_whitelist':
      return parseWhitelist(expected).some((entry) => caseInsensitiveEquals(actual, entry));
    case 'greater_than':
    case 'less_than': {
      const actualNumber = Number(actual);
      const expectedNumber = Number(expected);
      if (Number.isNaN(actualNumber) || Number.isNaN(expectedNumber)) return false;
      return operator === 'greater_than'
        ? actualNumber > expectedNumber
        : actualNumber < expectedNumber;
    }
    default:
      return false;
  }
}

/** Project the transaction onto the field a rule inspects. */
function resolveFieldValue(field: RuleField, tx: SimulationTransaction): string {
  switch (field) {
    case 'Transaction Amount':
      return String(tx.amount);
    case 'Asset Identifier':
      return tx.asset;
    case 'Destination Target':
      return tx.recipient;
    case 'Approved Account Whitelist':
      // The whitelist rule inspects the recipient against the rule's value list.
      return tx.recipient;
    default:
      return '';
  }
}

function actionToVerdict(action: RuleAction): SimulationVerdict {
  switch (action) {
    case 'allow':
      return 'allowed';
    case 'flag':
      return 'flagged';
    case 'block':
      return 'rejected';
    case 'require_approval':
      return 'flagged';
    default:
      return 'flagged';
  }
}

function describeComparison(
  field: RuleField,
  operator: RuleOperator,
  value: string,
  actual: string,
): string {
  const operatorLabel = operator.replace(/_/g, ' ');
  return `Checked "${field}" (actual: ${actual || '∅'}) ${operatorLabel} "${value}".`;
}

/**
 * Dry-run `tx` against `rules` in order. First matching clause wins, mirroring
 * firewall-style first-match policy engines; unmatched clauses are reported as
 * `pass` so the UI can show the full evaluation trail.
 */
export function simulateTransaction(
  tx: SimulationTransaction,
  rules: PolicyRule[],
): PolicySimulationOutput {
  const clauses: EvaluatedClause[] = [];
  const matchedClauseIndices: number[] = [];
  let verdict: SimulationVerdict = 'allowed';

  rules.forEach((rule, index) => {
    const actual = resolveFieldValue(rule.field, tx);
    const matched = compareValues(actual, rule.operator, rule.value);

    if (!matched) {
      clauses.push({
        index,
        rule,
        outcome: 'pass',
        detail: `${describeComparison(rule.field, rule.operator, rule.value, actual)} No match — clause not triggered.`,
      });
      return;
    }

    matchedClauseIndices.push(index);
    const clauseVerdict = actionToVerdict(rule.action);
    // Escalate: allowed < flagged < rejected.
    const severity: Record<SimulationVerdict, number> = { allowed: 0, flagged: 1, rejected: 2 };
    if (severity[clauseVerdict] > severity[verdict]) {
      verdict = clauseVerdict;
    }

    clauses.push({
      index,
      rule,
      outcome: 'matched',
      detail: `${describeComparison(rule.field, rule.operator, rule.value, actual)} Match — action "${rule.action.replace(/_/g, ' ')}" applies.`,
    });
  });

  const summary =
    verdict === 'allowed'
      ? 'Transaction is allowed by the current rule set.'
      : verdict === 'flagged'
        ? 'Transaction would be flagged for manual review before enforcement.'
        : 'Transaction would be rejected — enforcing this rule set would block it.';

  return { verdict, summary, clauses, matchedClauseIndices };
}

/** Convenience constructor for a zero-amount edge-case transaction. */
export function emptyTransaction(): SimulationTransaction {
  return { amount: 0, asset: 'XLM', recipient: '', agentTags: [] };
}

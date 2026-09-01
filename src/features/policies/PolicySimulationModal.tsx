'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  CheckCircle2,
  Flag,
  FlaskConical,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField, Input, Select } from '@/components/ui/input';
import { isValidStellarPublicKey } from '@/stores/freighter-store';
import { cn } from '@/lib/cn';
import {
  simulateTransaction,
  type EvaluatedClause,
  type PolicySimulationOutput,
  type SimulationVerdict,
} from './policySimulation';
import { ruleActionOptions, ruleFieldOptions, ruleOperatorOptions, type PolicyRule } from './rulesSchema';
import type { AssetSymbol } from './types';

/** Default clause set used when no builder rules are supplied. */
export const defaultSimulationRules: PolicyRule[] = [
  {
    field: 'Transaction Amount',
    operator: 'greater_than',
    value: '10000',
    action: 'block',
  },
  {
    field: 'Transaction Amount',
    operator: 'greater_than',
    value: '2500',
    action: 'require_approval',
  },
  {
    field: 'Approved Account Whitelist',
    operator: 'in_whitelist',
    value: 'GCGN7K2J2L5V4D7C7Y3M4KXH2Q5TK5A4P3W6QJDS4J2W5M5WQ4R5M, GDR5A5W4M7Z3H5Q7Q2J4W7C6QX3A9Y5K7D3V2L7S5Y5M3F4Q7B7',
    action: 'allow',
  },
  {
    field: 'Destination Target',
    operator: 'contains',
    value: 'exchange',
    action: 'flag',
  },
];

const ASSET_OPTIONS: AssetSymbol[] = ['XLM', 'USDC', 'BTC', 'ETH', 'EURC'];

const simulationFormSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number.' })
    .min(0, 'Amount cannot be negative.'),
  asset: z.enum(['XLM', 'USDC', 'BTC', 'ETH', 'EURC']),
  recipient: z
    .string()
    .trim()
    .min(1, 'Recipient address is required.')
    .refine(
      (value) => isValidStellarPublicKey(value),
      'Recipient must be a valid Stellar public key (G…, 56 characters).',
    ),
  agentTags: z.string().trim(),
});

export type SimulationFormValues = z.infer<typeof simulationFormSchema>;

const verdictMeta: Record<
  SimulationVerdict,
  { label: string; badgeVariant: 'success' | 'warning' | 'danger'; icon: React.ReactNode; srText: string }
> = {
  allowed: {
    label: 'Allowed',
    badgeVariant: 'success',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
    srText: 'This transaction would be allowed by the current rule set.',
  },
  flagged: {
    label: 'Flagged',
    badgeVariant: 'warning',
    icon: <Flag className="h-4 w-4" aria-hidden />,
    srText: 'This transaction would be flagged for manual review.',
  },
  rejected: {
    label: 'Rejected',
    badgeVariant: 'danger',
    icon: <ShieldAlert className="h-4 w-4" aria-hidden />,
    srText: 'This transaction would be rejected and blocked on-chain.',
  },
};

function ClauseRow({ clause }: { clause: EvaluatedClause }) {
  const matched = clause.outcome === 'matched';
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-sm border px-3 py-2.5',
        matched ? 'border-gold/40 bg-gold-soft/20' : 'border-border bg-surface-secondary/30',
      )}
    >
      <span
        className={cn(
          'mt-0.5 shrink-0',
          matched ? 'text-gold-strong' : 'text-foreground-muted',
        )}
        aria-hidden
      >
        {matched ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">
          <span className="mr-1.5 text-foreground-muted">#{clause.index + 1}</span>
          If {clause.rule.field} {clause.rule.operator.replace(/_/g, ' ')}{' '}
          <span className="font-mono text-2xs">{clause.rule.value}</span> then{' '}
          {clause.rule.action.replace(/_/g, ' ')}
        </p>
        <p className="mt-0.5 text-2xs text-foreground-secondary">{clause.detail}</p>
      </div>
      <Badge
        variant={matched ? 'gold' : 'outline'}
        size="sm"
        className="ml-auto shrink-0 self-center"
      >
        {matched ? 'Matched' : 'No match'}
      </Badge>
    </li>
  );
}

export interface PolicySimulationModalProps {
  open: boolean;
  onClose: () => void;
  /** Clause set to dry-run against; defaults to the sample ruleset. */
  rules?: PolicyRule[];
}

/**
 * Policy simulation sandbox — dry-runs a proposed transaction against policy
 * clauses before enforcement. Renders inside the accessible `Dialog`
 * primitive (portal, focus trap, Esc-to-close) and announces verdicts via a
 * polite live region for screen readers.
 */
export function PolicySimulationModal({ open, onClose, rules = defaultSimulationRules }: PolicySimulationModalProps) {
  const [result, setResult] = useState<PolicySimulationOutput | null>(null);
  const [submittedTx, setSubmittedTx] = useState<SimulationFormValues | null>(null);

  const form = useForm<SimulationFormValues>({
    resolver: zodResolver(simulationFormSchema),
    defaultValues: {
      amount: 1200,
      asset: 'USDC',
      recipient: 'GCGN7K2J2L5V4D7C7Y3M4KXH2Q5TK5A4P3W6QJDS4J2W5M5WQ4R5M',
      agentTags: 'treasury, routine-payout',
    },
  });

  const handleRun = (values: SimulationFormValues) => {
    const output = simulateTransaction(
      {
        amount: values.amount,
        asset: values.asset,
        recipient: values.recipient,
        agentTags: values.agentTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      },
      rules,
    );
    setSubmittedTx(values);
    setResult(output);
  };

  const handleClose = () => {
    onClose();
  };

  const verdict = result ? verdictMeta[result.verdict] : null;
  const summaryText = useMemo(() => {
    if (!result || !submittedTx) return '';
    return `${submittedTx.amount} ${submittedTx.asset} to ${submittedTx.recipient.slice(0, 6)}… — ${result.summary}`;
  }, [result, submittedTx]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Policy simulation sandbox"
      description="Dry-run a proposed transaction against the rule set before enforcing it on-chain."
      size="lg"
    >
      <form
        onSubmit={form.handleSubmit(handleRun)}
        noValidate
        aria-label="Transaction simulation inputs"
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Amount"
            required
            error={form.formState.errors.amount?.message}
            htmlFor="sim-amount"
          >
            <Input
              id="sim-amount"
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 1200"
              invalid={Boolean(form.formState.errors.amount)}
              {...form.register('amount')}
            />
          </FormField>

          <FormField
            label="Asset"
            required
            htmlFor="sim-asset"
            error={form.formState.errors.asset?.message}
          >
            <Select id="sim-asset" {...form.register('asset')}>
              {ASSET_OPTIONS.map((asset) => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField
          label="Recipient address"
          required
          hint="Stellar public key starting with G"
          htmlFor="sim-recipient"
          error={form.formState.errors.recipient?.message}
        >
          <Input
            id="sim-recipient"
            className="font-mono text-xs"
            placeholder="GABC…XYZ"
            invalid={Boolean(form.formState.errors.recipient)}
            {...form.register('recipient')}
          />
        </FormField>

        <FormField
          label="Agent tags"
          hint="Comma-separated tags used by contains-style rules"
          htmlFor="sim-tags"
          error={form.formState.errors.agentTags?.message}
        >
          <Input id="sim-tags" placeholder="treasury, routine-payout" {...form.register('agentTags')} />
        </FormField>

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="secondary" onClick={() => form.reset()}>
            Reset
          </Button>
          <Button
            type="submit"
            variant="gold"
            leftIcon={<PlayCircle className="h-4 w-4" aria-hidden />}
          >
            Run simulation
          </Button>
        </div>
      </form>

      {result && verdict && (
        <div
          className="mt-5 space-y-3 border-t border-border pt-5"
          role="region"
          aria-label="Simulation results"
        >
          <div
            className={cn(
              'flex items-center gap-3 rounded-card border p-4',
              result.verdict === 'allowed' && 'border-success/30 bg-success-soft/20',
              result.verdict === 'flagged' && 'border-warning/30 bg-warning-soft/20',
              result.verdict === 'rejected' && 'border-danger/30 bg-danger-soft/20',
            )}
          >
            <span
              className={cn(
                'shrink-0',
                result.verdict === 'allowed' && 'text-success',
                result.verdict === 'flagged' && 'text-warning',
                result.verdict === 'rejected' && 'text-danger',
              )}
              aria-hidden
            >
              {result.verdict === 'allowed' ? (
                <ShieldCheck className="h-6 w-6" />
              ) : result.verdict === 'flagged' ? (
                <Flag className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={verdict.badgeVariant} size="md">
                  {verdict.icon}
                  {verdict.label}
                </Badge>
                <span className="sr-only">{verdict.srText}</span>
              </div>
              <p className="mt-1 text-xs text-foreground-secondary">{result.summary}</p>
            </div>
          </div>

          {/* Polite live region so screen readers hear the outcome after each run. */}
          <p className="sr-only" role="status" aria-live="polite">
            {summaryText}
          </p>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              Evaluation breakdown — {result.clauses.length} clause
              {result.clauses.length === 1 ? '' : 's'} checked
            </p>
            {result.clauses.length > 0 ? (
              <ol className="space-y-2">
                {result.clauses.map((clause) => (
                  <ClauseRow key={`${clause.index}-${clause.rule.field}`} clause={clause} />
                ))}
              </ol>
            ) : (
              <p className="rounded-sm border border-dashed border-border bg-surface-secondary/30 px-3 py-2 text-xs text-foreground-secondary">
                No clauses are configured, so the transaction is allowed by default.
              </p>
            )}
          </div>

          <p className="text-2xs text-foreground-muted">
            Simulation only — no transaction was signed or submitted. Clauses are evaluated in
            order; the most severe matched action determines the verdict.
          </p>
        </div>
      )}
    </Dialog>
  );
}

/** Button + modal pair that can be dropped anywhere policy rules are managed. */
export function PolicySimulationSandbox({ rules }: { rules?: PolicyRule[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leftIcon={<FlaskConical className="h-3.5 w-3.5" aria-hidden />}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        Dry-run in sandbox
      </Button>
      <PolicySimulationModal open={open} onClose={() => setOpen(false)} rules={rules} />
    </>
  );
}

export default PolicySimulationModal;

// Re-exported for consumers building custom sandbox tooling on top of the modal.
export { ruleFieldOptions, ruleOperatorOptions, ruleActionOptions };

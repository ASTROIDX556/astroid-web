'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Play, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField, Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { type PolicyRule } from '../rulesSchema';
import {
  simulateTransaction,
  type SandboxSimulationResult,
  type RuleEvaluationResult,
} from '../utils/simulator';

const sandboxSchema = z.object({
  recipientAddress: z
    .string()
    .trim()
    .min(1, 'Recipient address is required')
    .min(56, 'Stellar public key must be 56 characters'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Amount must be a positive number'),
  asset: z.string().min(1, 'Asset type is required'),
});

type SandboxFormValues = z.infer<typeof sandboxSchema>;

const ASSET_OPTIONS = ['XLM', 'USDC', 'BTC', 'ETH', 'EURC'] as const;

const SAMPLE_RULES: PolicyRule[] = [
  {
    field: 'Transaction Amount',
    operator: 'greater_than',
    value: '10000',
    action: 'require_approval',
  },
  {
    field: 'Transaction Amount',
    operator: 'greater_than',
    value: '50000',
    action: 'block',
  },
  {
    field: 'Asset Identifier',
    operator: 'in_whitelist',
    value: 'XLM,USDC',
    action: 'block',
  },
  {
    field: 'Destination Target',
    operator: 'contains',
    value: 'blocked',
    action: 'block',
  },
  {
    field: 'Approved Account Whitelist',
    operator: 'in_whitelist',
    value: 'GCGN7K2J2L5V4D7C7Y3M4KXH2Q5TK5A4P3W6QJDS4J2W5M5WQ4R5M,GDR5A5W4M7Z3H5Q7Q2J4W7C6QX3A9Y5K7D3V2L7S5Y5M3F4Q7B7',
    action: 'require_approval',
  },
];

function formatAction(action: string): string {
  switch (action) {
    case 'require_approval':
      return 'Require Approval';
    case 'block':
      return 'Block';
    case 'flag':
      return 'Flag';
    case 'allow':
      return 'Allow';
    default:
      return action;
  }
}

function RuleResultCard({ result }: { result: RuleEvaluationResult }) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-xs',
        result.passed
          ? 'border-success/30 bg-success-soft/20'
          : 'border-danger/30 bg-danger-soft/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {result.passed ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
          )}
          <span className="font-medium text-foreground">
            {result.rule.field} {result.rule.operator} {result.rule.value}
          </span>
        </div>
        <Badge variant={result.passed ? 'success' : 'danger'} size="sm">
          {result.passed ? 'Pass' : 'Fail'}
        </Badge>
      </div>
      <p className="mt-1.5 pl-6 text-foreground-secondary">{result.message}</p>
      <p className="mt-1 pl-6 text-2xs text-foreground-muted">
        Action on violation: {formatAction(result.rule.action)}
      </p>
    </div>
  );
}

export interface PolicySandboxModalProps {
  open: boolean;
  onClose: () => void;
  rules?: PolicyRule[];
}

export function PolicySandboxModal({
  open,
  onClose,
  rules = SAMPLE_RULES,
}: PolicySandboxModalProps) {
  const [result, setResult] = useState<SandboxSimulationResult | null>(null);
  const [selectedRuleIndices, setSelectedRuleIndices] = useState<Set<number>>(
    () => new Set(rules.map((_, i) => i)),
  );

  const form = useForm<SandboxFormValues>({
    resolver: zodResolver(sandboxSchema),
    defaultValues: {
      recipientAddress: 'GABC12345678901234567890123456789012345678901234567890AB',
      amount: '15000',
      asset: 'USDC',
    },
  });

  const activeRules = useMemo(
    () => rules.filter((_, i) => selectedRuleIndices.has(i)),
    [rules, selectedRuleIndices],
  );

  const toggleRule = useCallback((index: number) => {
    setSelectedRuleIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    setResult(null);
  }, []);

  const selectAllRules = useCallback(() => {
    setSelectedRuleIndices(new Set(rules.map((_, i) => i)));
    setResult(null);
  }, [rules]);

  const deselectAllRules = useCallback(() => {
    setSelectedRuleIndices(new Set());
    setResult(null);
  }, []);

  const onSubmit = useCallback(
    (values: SandboxFormValues) => {
      const simulation = simulateTransaction(values, activeRules);
      setResult(simulation);
    },
    [activeRules],
  );

  const handleReset = useCallback(() => {
    form.reset();
    setResult(null);
  }, [form]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Policy Sandbox"
      description="Test a hypothetical transaction against spending policy rules before enforcement."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="gold"
            leftIcon={<Play className="h-4 w-4" aria-hidden />}
            onClick={form.handleSubmit(onSubmit)}
            disabled={activeRules.length === 0}
          >
            Run Simulation
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label="Recipient Address"
              required
              error={form.formState.errors.recipientAddress?.message}
              className="sm:col-span-2"
            >
              <Input
                {...form.register('recipientAddress')}
                placeholder="GABC...XYZ (56-character Stellar public key)"
              />
            </FormField>

            <FormField
              label="Asset Type"
              required
              error={form.formState.errors.asset?.message}
            >
              <Select {...form.register('asset')}>
                {ASSET_OPTIONS.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label="Transaction Amount"
              required
              error={form.formState.errors.amount?.message}
            >
              <Input
                {...form.register('amount')}
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 15000"
              />
            </FormField>

            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                onClick={handleReset}
                className="h-10"
              >
                Reset
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Policy Rules ({activeRules.length}/{rules.length} active)
            </h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllRules}
                className="text-2xs font-medium text-gold-strong hover:underline"
              >
                Select all
              </button>
              <span className="text-foreground-muted">·</span>
              <button
                type="button"
                onClick={deselectAllRules}
                className="text-2xs font-medium text-foreground-secondary hover:underline"
              >
                Deselect all
              </button>
            </div>
          </div>

          <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-border bg-surface-secondary/30 p-2.5">
            {rules.map((rule, i) => (
              <label
                key={i}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-surface-secondary/60',
                  selectedRuleIndices.has(i) && 'bg-surface-secondary/40',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedRuleIndices.has(i)}
                  onChange={() => toggleRule(i)}
                  className="h-3.5 w-3.5 rounded border-border accent-gold"
                />
                <span className="flex-1 truncate text-foreground">
                  {rule.field} {rule.operator} {rule.value}
                </span>
                <Badge variant="outline" size="sm">
                  {formatAction(rule.action)}
                </Badge>
              </label>
            ))}
          </div>

          {activeRules.length === 0 && (
            <p className="flex items-center gap-1.5 text-2xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Select at least one rule to run the simulation.
            </p>
          )}
        </div>

        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Simulation Results
              </h4>
              <Badge variant={result.passed ? 'success' : 'danger'} size="sm">
                {result.passed ? 'Compliant' : 'Violations Found'}
              </Badge>
            </div>

            <div
              className={cn(
                'rounded-md border p-3 text-xs font-medium',
                result.passed
                  ? 'border-success/30 bg-success-soft/20 text-success'
                  : 'border-danger/30 bg-danger-soft/20 text-danger',
              )}
            >
              {result.summary}
            </div>

            <div className="space-y-2">
              {result.results.map((r, i) => (
                <RuleResultCard key={i} result={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

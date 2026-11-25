'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, FlaskConical, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/input';
import type { Policy } from '@/types/domain';
import {
  defaultPolicyRules,
  mapPoliciesToSandboxRules,
  type PolicyRule,
} from './usePolicySimulation';

const simulationSchema = z.object({
  recipient: z.string().trim().min(1, 'Destination address is required.'),
  asset: z.string().trim().min(1, 'Asset type is required.'),
  amount: z
    .number()
    .finite('Enter a valid amount.')
    .nonnegative('Amount cannot be negative.'),
  agentId: z.string().trim().min(1, 'Calling agent ID is required.'),
});

type SimulationValues = z.infer<typeof simulationSchema>;

interface SimulationStep {
  rule: PolicyRule;
  status: 'pass' | 'fail' | 'review';
  message: string;
}

interface SimulationResult {
  outcome: 'permitted' | 'blocked' | 'review' | 'unconfigured';
  steps: SimulationStep[];
  values: SimulationValues;
}

export interface TransactionSimulationPreviewModalProps {
  open: boolean;
  onClose: () => void;
  policies?: Policy[];
}

function isWithinTimeWindow(start: string, end: string, now: Date): boolean {
  const parseTime = (value: string): number | null => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);
  if (startMinutes === null || endMinutes === null) return false;

  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return startMinutes <= endMinutes
    ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
    : currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function evaluateRules(
  values: SimulationValues,
  rules: PolicyRule[],
): SimulationStep[] {
  const asset = values.asset.toUpperCase();
  return rules
    .filter((rule) => rule.enabled)
    .map((rule) => {
      switch (rule.type) {
        case 'max_amount': {
          if (rule.threshold === undefined) {
            return {
              rule,
              status: 'review',
              message: 'This rule has no configured amount limit.',
            };
          }
          const passed = values.amount <= rule.threshold;
          return {
            rule,
            status: passed ? 'pass' : 'fail',
            message: passed
              ? `Amount $${values.amount.toLocaleString()} is within the $${rule.threshold.toLocaleString()} maximum.`
              : `Amount $${values.amount.toLocaleString()} exceeds the $${rule.threshold.toLocaleString()} maximum.`,
          };
        }
        case 'min_amount': {
          if (rule.threshold === undefined) {
            return {
              rule,
              status: 'review',
              message: 'This rule has no configured minimum amount.',
            };
          }
          const passed = values.amount >= rule.threshold;
          return {
            rule,
            status: passed ? 'pass' : 'fail',
            message: passed
              ? `Amount $${values.amount.toLocaleString()} meets the $${rule.threshold.toLocaleString()} minimum.`
              : `Amount $${values.amount.toLocaleString()} is below the $${rule.threshold.toLocaleString()} minimum.`,
          };
        }
        case 'allowed_assets': {
          const allowed = (rule.allowedAssets ?? []).map((value) =>
            value.toUpperCase(),
          );
          const passed = allowed.includes(asset);
          return {
            rule,
            status: passed ? 'pass' : 'fail',
            message: passed
              ? `${asset} is on the allowed asset list.`
              : `${asset} is not on the allowed asset list${allowed.length ? ` (${allowed.join(', ')})` : ''}.`,
          };
        }
        case 'allowed_recipients': {
          const allowed = rule.allowedRecipients ?? [];
          const passed =
            allowed.length === 0 ||
            allowed.some(
              (address) => address.toUpperCase() === values.recipient.toUpperCase(),
            );
          return {
            rule,
            status: passed ? 'pass' : 'fail',
            message: passed
              ? allowed.length === 0
                ? 'No recipient allow-list is configured.'
                : 'Destination address matches an allowed recipient.'
              : 'Destination address does not match an allowed recipient.',
          };
        }
        case 'blocked_recipients': {
          const blocked = rule.blockedRecipients ?? [];
          const match = blocked.some(
            (address) => address.toUpperCase() === values.recipient.toUpperCase(),
          );
          return {
            rule,
            status: match ? 'fail' : 'pass',
            message: match
              ? 'Destination address matches a blocked recipient.'
              : 'Destination address is not on the blocked recipient list.',
          };
        }
        case 'multi_sig': {
          const required = rule.requiredCoSigners ?? 2;
          return {
            rule,
            status: required > 1 ? 'fail' : 'pass',
            message:
              required > 1
                ? `This transaction requires ${required} co-signers; none were supplied for this preview.`
                : 'No additional co-signers are required.',
          };
        }
        case 'rate_limit':
          return {
            rule,
            status: 'review',
            message: rule.rateLimitPerHour
              ? `The limit is ${rule.rateLimitPerHour} transactions per hour; current usage must be checked at execution time.`
              : 'Current transaction usage must be checked at execution time.',
          };
        case 'time_window': {
          if (!rule.windowStart || !rule.windowEnd) {
            return {
              rule,
              status: 'review',
              message: 'This rule has no complete execution window configured.',
            };
          }
          const passed = isWithinTimeWindow(
            rule.windowStart,
            rule.windowEnd,
            new Date(),
          );
          return {
            rule,
            status: passed ? 'pass' : 'fail',
            message: passed
              ? `Current UTC time is within the ${rule.windowStart}–${rule.windowEnd} execution window.`
              : `Current UTC time is outside the ${rule.windowStart}–${rule.windowEnd} execution window.`,
          };
        }
        case 'budget_limit': {
          if (rule.budgetLimitUsd === undefined) {
            return {
              rule,
              status: 'review',
              message: 'This rule has no configured budget limit.',
            };
          }
          const passed = values.amount <= rule.budgetLimitUsd;
          return {
            rule,
            status: passed ? 'pass' : 'fail',
            message: passed
              ? `Amount is within the $${rule.budgetLimitUsd.toLocaleString()} budget limit.`
              : `Amount exceeds the $${rule.budgetLimitUsd.toLocaleString()} budget limit.`,
          };
        }
        case 'emergency_lock': {
          const passed = !rule.emergencyActive;
          return {
            rule,
            status: passed ? 'pass' : 'fail',
            message: passed
              ? 'Emergency lock is inactive.'
              : 'Emergency lock is active; transactions are halted.',
          };
        }
      }
    });
}

const defaultValues: SimulationValues = {
  recipient: 'GAOPENAI7VENDORQK9M2WL4PC8RD3YHF6JN1STELLARWALLETXZ',
  asset: 'USDC',
  amount: 5000,
  agentId: 'agt_atlas',
};

export function TransactionSimulationPreviewModal({
  open,
  onClose,
  policies,
}: TransactionSimulationPreviewModalProps) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SimulationValues>({
    resolver: zodResolver(simulationSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setResult(null);
    }
  }, [open, reset]);

  const rules =
    policies && policies.length > 0
      ? mapPoliciesToSandboxRules(policies)
      : defaultPolicyRules;

  const runSimulation = (values: SimulationValues) => {
    const steps = evaluateRules(values, rules);
    const outcome =
      steps.length === 0
        ? 'unconfigured'
        : steps.some((step) => step.status === 'fail')
          ? 'blocked'
          : steps.some((step) => step.status === 'review')
            ? 'review'
            : 'permitted';
    setResult({ outcome, steps, values });
  };

  const status = result?.outcome;
  const statusLabel =
    status === 'permitted'
      ? 'Permitted'
      : status === 'blocked'
        ? 'Blocked'
        : status === 'review'
          ? 'Needs runtime review'
          : 'No active rules';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Transaction simulation preview"
      description="Preview a proposed transaction against the currently active spending rules. This does not submit a transaction."
      className="max-h-[90vh] overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <form
          className="space-y-5"
          onSubmit={handleSubmit(runSimulation)}
          onChange={() => setResult(null)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Destination address"
              htmlFor="simulation-recipient"
              required
              error={errors.recipient?.message}
              className="gap-2"
            >
              <Input
                id="simulation-recipient"
                placeholder="Stellar destination address"
                invalid={Boolean(errors.recipient)}
                {...register('recipient')}
              />
            </FormField>
            <FormField
              label="Asset type"
              htmlFor="simulation-asset"
              required
              error={errors.asset?.message}
              className="gap-2"
            >
              <Input
                id="simulation-asset"
                list="simulation-assets"
                placeholder="Enter an asset code"
                invalid={Boolean(errors.asset)}
                {...register('asset')}
              />
              <datalist id="simulation-assets">
                <option value="XLM" />
                <option value="USDC" />
                <option value="BTC" />
                <option value="ETH" />
                <option value="EURC" />
              </datalist>
            </FormField>
            <FormField
              label="Amount (USD)"
              htmlFor="simulation-amount"
              required
              hint="Zero is valid and will be checked against the active rules."
              error={errors.amount?.message}
              className="gap-2"
            >
              <Input
                id="simulation-amount"
                type="number"
                min="0"
                step="any"
                invalid={Boolean(errors.amount)}
                {...register('amount', { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              label="Calling agent ID"
              htmlFor="simulation-agent"
              required
              error={errors.agentId?.message}
              className="gap-2"
            >
              <Input
                id="simulation-agent"
                placeholder="agt_atlas"
                invalid={Boolean(errors.agentId)}
                {...register('agentId')}
              />
            </FormField>
          </div>

          <div className="flex justify-end">
            <Button
              variant="gold"
              type="submit"
              leftIcon={<FlaskConical className="h-4 w-4" aria-hidden />}
            >
              Run simulation
            </Button>
          </div>
        </form>

        <AnimatePresence mode="wait">
          {result && (
            <motion.section
              key={result.outcome}
              aria-labelledby="simulation-result-title"
              aria-live="polite"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-6 space-y-3"
            >
              <div
                className={`flex items-center gap-3 rounded-card border p-4 ${
                  result.outcome === 'permitted'
                    ? 'border-success/30 bg-success-soft/30'
                    : result.outcome === 'blocked'
                      ? 'border-danger/30 bg-danger-soft/30'
                      : 'border-warning/30 bg-warning-soft/30'
                }`}
                role="status"
              >
                {result.outcome === 'permitted' ? (
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                ) : result.outcome === 'blocked' ? (
                  <XCircle className="h-5 w-5 text-danger" aria-hidden />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <h3
                    id="simulation-result-title"
                    className="text-sm font-semibold text-foreground"
                  >
                    Transaction {statusLabel.toLowerCase()}
                  </h3>
                  <p className="mt-1 text-xs text-foreground-secondary">
                    {result.steps.filter((step) => step.status === 'pass').length} of{' '}
                    {result.steps.length} rules passed · $
                    {result.values.amount.toLocaleString()} {result.values.asset} ·
                    agent {result.values.agentId}
                  </p>
                </div>
                <Badge
                  variant={
                    result.outcome === 'permitted'
                      ? 'success'
                      : result.outcome === 'blocked'
                        ? 'danger'
                        : 'warning'
                  }
                  dot
                >
                  {statusLabel}
                </Badge>
              </div>

              {result.steps.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border p-3 text-xs text-foreground-secondary">
                  No enabled policy rules are available to evaluate this transaction.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {result.steps.map((step) => (
                    <div
                      key={step.rule.id}
                      className={`py-2.5 rounded-sm border px-3 ${
                        step.status === 'pass'
                          ? 'border-success/20 bg-success-soft/20'
                          : step.status === 'fail'
                            ? 'border-danger/20 bg-danger-soft/20'
                            : 'border-warning/20 bg-warning-soft/20'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-foreground">
                          {step.rule.name}
                        </p>
                        <Badge
                          variant={
                            step.status === 'pass'
                              ? 'success'
                              : step.status === 'fail'
                                ? 'danger'
                                : 'warning'
                          }
                          size="sm"
                        >
                          {step.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="mt-1 text-2xs leading-relaxed text-foreground-secondary">
                        {step.message}
                      </p>
                      <p className="mt-1 text-2xs text-foreground-muted">
                        {step.rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </motion.div>
    </Dialog>
  );
}

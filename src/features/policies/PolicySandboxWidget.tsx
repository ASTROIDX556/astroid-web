'use client';

import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField, Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { Policy } from '@/types/domain';
import { defaultPolicyRules, mapPoliciesToSandboxRules, type PolicyRule } from './usePolicySimulation';

// ---------------------------------------------------------------------------
// Zod schema for sandbox transaction input
// ---------------------------------------------------------------------------

const sandboxTransactionSchema = z.object({
  recipient: z
    .string()
    .trim()
    .min(1, 'Recipient address is required.')
    .min(56, 'Stellar address must be at least 56 characters.')
    .max(64, 'Stellar address must be at most 64 characters.'),
  amount: z.coerce
    .number({ message: 'Amount must be a number.' })
    .positive('Amount must be greater than zero.'),
  asset: z.enum(['XLM', 'USDC', 'BTC', 'ETH', 'EURC'], {
    message: 'Asset must be one of XLM, USDC, BTC, ETH, or EURC.',
  }),
  agentId: z
    .string()
    .trim()
    .min(1, 'Agent ID is required.'),
  memo: z.string().max(140, 'Memo must be 140 characters or fewer.').optional(),
});

type SandboxFormValues = z.infer<typeof sandboxTransactionSchema>;

// ---------------------------------------------------------------------------
// Evaluation types
// ---------------------------------------------------------------------------

interface EvaluationStep {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  message: string;
  reasonCode: string;
}

interface SandboxEvaluationResult {
  outcome: 'approved' | 'flagged' | 'rejected';
  steps: EvaluationStep[];
  riskScore: number;
}

// ---------------------------------------------------------------------------
// Default form values
// ---------------------------------------------------------------------------

const defaultFormValues: SandboxFormValues = {
  recipient: 'GAOPENAI7VENDORQK9M2WL4PC8RD3YHF6JN1STELLARWALLETXZ',
  amount: 5000,
  asset: 'USDC',
  agentId: 'agt_atlas',
  memo: 'Policy sandbox test — hypothetical transfer',
};

// ---------------------------------------------------------------------------
// Risk scoring helper
// ---------------------------------------------------------------------------

function computeRiskScore(values: SandboxFormValues, steps: EvaluationStep[]): number {
  let score = 0;
  const failed = steps.filter((s) => !s.passed);
  score += failed.length * 25;
  if (values.amount > 25000) score += 20;
  if (values.amount > 10000) score += 10;
  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// PolicySandboxWidget
// ---------------------------------------------------------------------------

interface PolicySandboxWidgetProps {
  /** Live policies fetched from the API. When provided, overrides the built-in defaults. */
  policies?: Policy[];
}

export function PolicySandboxWidget({ policies }: PolicySandboxWidgetProps) {
  const [values, setValues] = useState<SandboxFormValues>(defaultFormValues);
  const [errors, setErrors] = useState<Partial<Record<keyof SandboxFormValues, string>>>({});
  const [result, setResult] = useState<SandboxEvaluationResult | null>(null);

  // -- Handlers -----------------------------------------------------------

  const updateField = useCallback(
    <K extends keyof SandboxFormValues>(field: K, value: SandboxFormValues[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      // Clear field error on change
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const resetForm = useCallback(() => {
    setValues(defaultFormValues);
    setErrors({});
    setResult(null);
  }, []);

  // Resolve which rules to evaluate against: live policies take precedence.
  const activeRules: PolicyRule[] = useMemo(() => {
    if (policies && policies.length > 0) {
      return mapPoliciesToSandboxRules(policies);
    }
    return defaultPolicyRules;
  }, [policies]);

  const runEvaluation = useCallback(() => {
    const parsed = sandboxTransactionSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof SandboxFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof SandboxFormValues | undefined;
        if (field) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      setResult(null);
      return;
    }

    const validated = parsed.data;
    const steps: EvaluationStep[] = [];

    // Evaluate against each enabled policy rule
    for (const rule of activeRules) {
      if (!rule.enabled) continue;

      let passed = true;
      let message = '';
      let reasonCode = '';

      switch (rule.type) {
        case 'max_amount': {
          if (rule.threshold !== undefined) {
            passed = validated.amount <= rule.threshold;
            message = passed
              ? `Amount $${validated.amount.toLocaleString()} is within the $${rule.threshold.toLocaleString()} cap.`
              : `Amount $${validated.amount.toLocaleString()} exceeds the $${rule.threshold.toLocaleString()} maximum threshold.`;
            reasonCode = passed ? 'AMOUNT_WITHIN_CAP' : 'AMOUNT_EXCEEDS_THRESHOLD';
          }
          break;
        }

        case 'allowed_assets': {
          const allowed = rule.allowedAssets ?? [];
          passed = allowed.includes(validated.asset);
          message = passed
            ? `Asset ${validated.asset} is on the allow-list.`
            : `Asset ${validated.asset} is not on the allowed assets list (${allowed.join(', ')}).`;
          reasonCode = passed ? 'ASSET_ALLOWED' : 'ASSET_BLOCKED';
          break;
        }

        case 'multi_sig': {
          // Sandbox always simulates a single signer
          const required = rule.requiredCoSigners ?? 2;
          passed = required <= 1;
          message = passed
            ? 'Sufficient signatures present.'
            : `This transaction requires ${required} co-signers but only 1 is present in sandbox mode.`;
          reasonCode = passed ? 'MULTISIG_SATISFIED' : 'MULTISIG_INSUFFICIENT';
          break;
        }

        case 'allowed_recipients': {
          const allowed = rule.allowedRecipients ?? [];
          passed = allowed.length === 0 || allowed.some((r) => validated.recipient.includes(r));
          message = passed
            ? `Recipient is on the approved vendor list.`
            : `Recipient is not on the approved vendor list (${allowed.join(', ')}).`;
          reasonCode = passed ? 'RECIPIENT_ALLOWED' : 'RECIPIENT_BLOCKED';
          break;
        }

        case 'blocked_recipients': {
          const blocked = rule.blockedRecipients ?? [];
          passed = !blocked.some((r) => validated.recipient.includes(r));
          message = passed
            ? `Recipient is not on the blocklist.`
            : `Recipient matches a blocked address on the deny list.`;
          reasonCode = passed ? 'RECIPIENT_CLEAR' : 'RECIPIENT_BLOCKED';
          break;
        }

        case 'rate_limit': {
          // In sandbox mode we flag rate-limited rules as needing runtime context
          passed = true;
          message = rule.rateLimitPerHour
            ? `Rate limit of ${rule.rateLimitPerHour} txns/hr applies — verified at execution time.`
            : 'Rate limit rule present — evaluated at execution time.';
          reasonCode = 'RATE_LIMIT_NOTE';
          break;
        }

        case 'time_window': {
          const now = new Date();
          const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
          if (rule.windowStart && rule.windowEnd) {
            const [startH, startM] = rule.windowStart.split(':').map(Number);
            const [endH, endM] = rule.windowEnd.split(':').map(Number);
            const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
            const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);
            passed = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
          }
          message = passed
            ? `Current time is within the allowed execution window (${rule.windowStart ?? '?'}–${rule.windowEnd ?? '?'}).`
            : `Current time is outside the allowed execution window (${rule.windowStart ?? '?'}–${rule.windowEnd ?? '?'}).`;
          reasonCode = passed ? 'TIME_WINDOW_OPEN' : 'TIME_WINDOW_CLOSED';
          break;
        }

        case 'budget_limit': {
          if (rule.budgetLimitUsd !== undefined) {
            passed = validated.amount <= rule.budgetLimitUsd;
            message = passed
              ? `Amount $${validated.amount.toLocaleString()} is within the budget cap of $${rule.budgetLimitUsd.toLocaleString()}.`
              : `Amount $${validated.amount.toLocaleString()} exceeds the budget cap of $${rule.budgetLimitUsd.toLocaleString()}.`;
            reasonCode = passed ? 'BUDGET_WITHIN_CAP' : 'BUDGET_EXCEEDED';
          }
          break;
        }

        case 'emergency_lock': {
          passed = !rule.emergencyActive;
          message = rule.emergencyActive
            ? 'Emergency stop is active — all transactions are halted.'
            : 'Emergency stop is inactive — transactions may proceed.';
          reasonCode = passed ? 'EMERGENCY_INACTIVE' : 'EMERGENCY_ACTIVE';
          break;
        }
      }

      steps.push({
        ruleId: rule.id,
        ruleName: rule.name,
        passed,
        message,
        reasonCode,
      });
    }

    const failedSteps = steps.filter((s) => !s.passed);
    let outcome: SandboxEvaluationResult['outcome'] = 'approved';
    if (failedSteps.length > 0) {
      const hasBlocking = failedSteps.some(
        (s) =>
          s.reasonCode === 'AMOUNT_EXCEEDS_THRESHOLD' ||
          s.reasonCode === 'ASSET_BLOCKED' ||
          s.reasonCode === 'RECIPIENT_BLOCKED' ||
          s.reasonCode === 'EMERGENCY_ACTIVE' ||
          s.reasonCode === 'BUDGET_EXCEEDED',
      );
      outcome = hasBlocking ? 'rejected' : 'flagged';
    }

    const riskScore = computeRiskScore(validated, steps);

    setResult({ outcome, steps, riskScore });
  }, [values, activeRules]);

  // -- Derived -----------------------------------------------------------

  const outcomeConfig = useMemo(() => {
    if (!result) return null;
    switch (result.outcome) {
      case 'approved':
        return {
          label: 'Approved',
          icon: CheckCircle2,
          badgeVariant: 'success' as const,
          color: 'text-success',
          bg: 'bg-success-soft/40',
          border: 'border-success/30',
        };
      case 'flagged':
        return {
          label: 'Flagged',
          icon: AlertTriangle,
          badgeVariant: 'warning' as const,
          color: 'text-warning',
          bg: 'bg-warning-soft/40',
          border: 'border-warning/30',
        };
      case 'rejected':
        return {
          label: 'Rejected',
          icon: XCircle,
          badgeVariant: 'danger' as const,
          color: 'text-danger',
          bg: 'bg-danger-soft/40',
          border: 'border-danger/30',
        };
    }
  }, [result]);

  // -- Render ------------------------------------------------------------

  return (
    <Card className="overflow-hidden border border-border bg-surface/70">
      <CardHeader className="border-b border-border bg-surface/60">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm text-foreground">
            <FlaskConical className="h-4 w-4 text-gold" aria-hidden />
            Policy evaluation sandbox
          </CardTitle>
          <Badge variant="gold" size="sm">
            Real-time
          </Badge>
        </div>
        <p className="text-xs text-foreground-secondary">
          Test hypothetical transactions against active spending rules. See
          whether a transaction would be approved, flagged, or rejected.
        </p>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {/* Input form */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Recipient address"
            htmlFor="sandbox-recipient"
            required
            error={errors.recipient}
            className="gap-2"
          >
            <Input
              id="sandbox-recipient"
              value={values.recipient}
              onChange={(e) => updateField('recipient', e.target.value)}
              placeholder="GA…Stellar address"
              aria-invalid={Boolean(errors.recipient)}
            />
          </FormField>

          <FormField
            label="Amount (USD)"
            htmlFor="sandbox-amount"
            required
            error={errors.amount}
            className="gap-2"
          >
            <Input
              id="sandbox-amount"
              type="number"
              min={0.01}
              step="0.01"
              value={values.amount}
              onChange={(e) => updateField('amount', Number(e.target.value))}
              placeholder="5000"
              aria-invalid={Boolean(errors.amount)}
            />
          </FormField>

          <FormField
            label="Asset"
            htmlFor="sandbox-asset"
            required
            error={errors.asset}
            className="gap-2"
          >
            <Select
              id="sandbox-asset"
              value={values.asset}
              onChange={(e) => updateField('asset', e.target.value as SandboxFormValues['asset'])}
              aria-invalid={Boolean(errors.asset)}
            >
              <option value="XLM">XLM — Stellar Lumens</option>
              <option value="USDC">USDC — USD Coin</option>
              <option value="BTC">BTC — Wrapped Bitcoin</option>
              <option value="ETH">ETH — Wrapped Ethereum</option>
              <option value="EURC">EURC — Euro Coin</option>
            </Select>
          </FormField>

          <FormField
            label="Agent ID"
            htmlFor="sandbox-agent"
            required
            error={errors.agentId}
            className="gap-2"
          >
            <Input
              id="sandbox-agent"
              value={values.agentId}
              onChange={(e) => updateField('agentId', e.target.value)}
              placeholder="agt_atlas"
              aria-invalid={Boolean(errors.agentId)}
            />
          </FormField>

          <FormField
            label="Memo (optional)"
            htmlFor="sandbox-memo"
            error={errors.memo}
            className="md:col-span-2 gap-2"
          >
            <Input
              id="sandbox-memo"
              value={values.memo ?? ''}
              onChange={(e) => updateField('memo', e.target.value || undefined)}
              placeholder="Optional transaction memo"
            />
          </FormField>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="gold"
            type="button"
            onClick={runEvaluation}
            leftIcon={<Play className="h-4 w-4" aria-hidden />}
          >
            Evaluate transaction
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={resetForm}
            leftIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
          >
            Reset
          </Button>
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {result && outcomeConfig && (
            <motion.div
              key={result.outcome}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              {/* Outcome banner */}
              <div
                className={cn(
                  'flex items-center gap-3 rounded-card border p-4',
                  outcomeConfig.bg,
                  outcomeConfig.border,
                )}
                role="status"
                aria-live="polite"
              >
                <outcomeConfig.icon className={cn('h-5 w-5', outcomeConfig.color)} aria-hidden />
                <div className="flex-1">
                  <p className={cn('text-sm font-semibold', outcomeConfig.color)}>
                    Transaction {outcomeConfig.label}
                  </p>
                  <p className="text-xs text-foreground-secondary">
                    Risk score: {result.riskScore}/100 ·{' '}
                    {result.steps.filter((s) => s.passed).length}/{result.steps.length} rules passed
                  </p>
                </div>
                <Badge variant={outcomeConfig.badgeVariant} dot size="md">
                  {outcomeConfig.label}
                </Badge>
              </div>

              {/* Step-by-step evaluation breakdown */}
              <div className="space-y-2">
                <p className="text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
                  Evaluation breakdown
                </p>
                {result.steps.map((step, index) => (
                  <motion.div
                    key={step.ruleId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06, duration: 0.2 }}
                    className={cn(
                      'flex items-start gap-3 rounded-sm border px-3 py-2.5',
                      step.passed
                        ? 'border-success/20 bg-success-soft/20'
                        : 'border-danger/20 bg-danger-soft/20',
                    )}
                  >
                    <span className="mt-0.5 shrink-0">
                      {step.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                      ) : (
                        <XCircle className="h-4 w-4 text-danger" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">{step.ruleName}</p>
                        <Badge variant={step.passed ? 'success' : 'danger'} size="sm">
                          {step.passed ? 'PASS' : 'FAIL'}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-2xs leading-relaxed text-foreground-secondary">
                        {step.message}
                      </p>
                      <p className="mt-0.5 font-mono text-2xs text-foreground-muted">
                        reason: {step.reasonCode}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Summary row */}
              <div className="flex items-center gap-2 rounded-card border border-border bg-surface p-3 text-xs">
                <Shield className="h-4 w-4 text-gold shrink-0" aria-hidden />
                <span className="text-foreground-secondary">
                  Evaluated {result.steps.length} policy rules against a{' '}
                  <span className="font-medium text-foreground">${values.amount.toLocaleString()}</span>{' '}
                  <span className="font-medium text-foreground">{values.asset}</span> transaction.
                </span>
                <ArrowRight className="h-3 w-3 text-foreground-muted shrink-0" />
                <span className={cn('font-semibold', outcomeConfig.color)}>
                  {outcomeConfig.label}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

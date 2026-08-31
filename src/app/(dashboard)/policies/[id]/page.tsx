'use client';

import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, Check, Gauge, Play, ShieldAlert, X } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue, SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePolicy, usePolicySimulation } from '@/hooks/use-queries';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/format';
import type { PolicySimulationResult } from '@/types/domain';
import { PageTransition, AnimatedNumber } from '@/components/ui/motion';
import { TransactionSimulator } from '@/features/policies/TransactionSimulator';

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

const outcomeMeta: Record<
  PolicySimulationResult['predictedOutcome'],
  { label: string; variant: 'success' | 'warning' | 'danger' }
> = {
  auto_execute: { label: 'Auto-execute', variant: 'success' },
  requires_approval: { label: 'Requires approval', variant: 'warning' },
  blocked: { label: 'Blocked', variant: 'danger' },
};

function renderConfigValue(value: string | number | boolean | string[]): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default function PolicyDetailPage({ params }: { params: { id: string } }) {
  const policy = usePolicy(params.id);
  const sim = usePolicySimulation();
  const [amount, setAmount] = useState(1000);
  const [isPolicyBuilderOpen, setIsPolicyBuilderOpen] = useState(false);

  return (
    <PageTransition className="space-y-8">
      <Link
        href="/policies"
        className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to policies
      </Link>

      <QueryBoundary
        query={policy}
        loading={
          <div className="space-y-6">
            <div className="skeleton h-24 w-full rounded-card" />
            <div className="skeleton h-64 w-full rounded-card" />
          </div>
        }
      >
        {(data) => {
          const config = Object.entries(data.configuration);
          return (
            <div className="space-y-8">
              <PageHeader
                eyebrow={titleCase(data.type)}
                title={data.name}
                description={data.description}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge variant={data.enabled ? 'success' : 'neutral'} dot>
                      {data.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPolicyBuilderOpen((open) => !open)}
                      aria-expanded={isPolicyBuilderOpen}
                      leftIcon={<ShieldAlert className="h-4 w-4" aria-hidden />}
                    >
                      {isPolicyBuilderOpen ? 'Close builder' : 'Policy builder'}
                    </Button>
                  </div>
                }
              />

              <Card className="p-5">
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <KeyValue label="Type">{titleCase(data.type)}</KeyValue>
                  <KeyValue label="Priority">{formatNumber(data.priority)}</KeyValue>
                  <KeyValue label="Status">
                    {data.enabled ? 'Enabled' : 'Disabled'}
                  </KeyValue>
                  <KeyValue label="Applies to">
                    {formatNumber(data.appliesTo)}{' '}
                    {data.appliesTo === 1 ? 'agent' : 'agents'}
                  </KeyValue>
                  <KeyValue label="Violations (30d)">
                    {data.violations30d > 0 ? (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                        {formatNumber(data.violations30d)}
                      </span>
                    ) : (
                      formatNumber(data.violations30d)
                    )}
                  </KeyValue>
                  <KeyValue label="Created">{formatDateTime(data.createdAt)}</KeyValue>
                </dl>
              </Card>

              {config.length > 0 && (
                <div className="space-y-4">
                  <SectionLabel>Configuration</SectionLabel>
                  <Card className="p-5">
                    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                      {config.map(([key, value]) => (
                        <KeyValue key={key} label={titleCase(key)}>
                          {renderConfigValue(value)}
                        </KeyValue>
                      ))}
                    </dl>
                  </Card>
                </div>
              )}

              {isPolicyBuilderOpen && (
                <div className="space-y-4">
                  <SectionLabel>Policy builder</SectionLabel>
                  <Card className="p-5">
                    <PolicyForm
                      policyId={params.id}
                      defaultValues={data}
                    />
                  </Card>
                </div>
              )}

              <div className="space-y-4">
                <SectionLabel>Policy simulator</SectionLabel>
                <Card elevation="soft" className="relative overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 bg-gold-sheen" aria-hidden />
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Gauge className="h-4 w-4 text-gold" aria-hidden />
                      Dry-run a spend against every active policy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="flex-1">
                        <span className="mb-1.5 block text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
                          Amount (USDC)
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                          leftIcon={<span className="text-sm">$</span>}
                        />
                      </label>
                      <Button
                        variant="gold"
                        leftIcon={<Play className="h-4 w-4" />}
                        loading={sim.isPending}
                        onClick={() => sim.mutate(amount)}
                      >
                        Run simulation
                      </Button>
                    </div>

                    {sim.data && (
                      <SimulationResult result={sim.data} />
                    )}
                  </CardContent>
                </Card>

                <TransactionSimulator />
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

type RuleType = 'daily_limit' | 'token_restriction' | 'recipient_whitelist';

export type PolicyRuleDraft = {
  id: string;
  ruleType: RuleType;
  maxAmount: string;
  asset: string;
  allowedTokens: string;
  allowedRecipients: string;
};

export type PolicyFormValues = {
  name: string;
  description?: string;
  enabled: boolean;
  rules: PolicyRuleDraft[];
};

type PolicyFormProps = {
  policyId: string;
  defaultValues?: Partial<PolicyFormValues>;
};

const STELLAR_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

const policyFormSchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  description: z.string().optional().default(''),
  enabled: z.boolean(),
  rules: z
    .array(
      z.object({
        id: z.string().min(1),
        ruleType: z.enum(['daily_limit', 'token_restriction', 'recipient_whitelist']),
        maxAmount: z.string().optional().default(''),
        asset: z.string().optional().default(''),
        allowedTokens: z.string().optional().default(''),
        allowedRecipients: z.string().optional().default(''),
      })
      .superRefine((rule, ctx) => {
        if (rule.ruleType === 'daily_limit') {
          if (!rule.maxAmount?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['maxAmount'],
              message: 'Daily cap is required',
            });
          } else if (Number.isNaN(Number(rule.maxAmount)) || Number(rule.maxAmount) < 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['maxAmount'],
              message: 'Daily cap cannot be negative',
            });
          }
          if (!rule.asset?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['asset'],
              message: 'Asset is required',
            });
          }
        }
        if (rule.ruleType === 'token_restriction' && !(rule.allowedTokens ?? '').split(',').some((token) => token.trim())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['allowedTokens'],
            message: 'Add at least one token',
          });
        }
        if (rule.ruleType === 'recipient_whitelist') {
          const recipients = (rule.allowedRecipients ?? '')
            .split(',')
            .map((recipient) => recipient.trim())
            .filter(Boolean);
          if (recipients.length === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['allowedRecipients'],
              message: 'Add at least one recipient',
            });
          }
          recipients.forEach((recipient) => {
            if (!STELLAR_ADDRESS_PATTERN.test(recipient)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['allowedRecipients'],
                message: `Invalid Stellar address: ${recipient}`,
              });
            }
          });
        }
      }),
    )
    .min(1, 'Add at least one policy rule'),
});

function createDefaultRule(ruleType: RuleType = 'daily_limit'): PolicyRuleDraft {
  return {
    id: `${Date.now()}-${Math.random()}`,
    ruleType,
    maxAmount: '',
    asset: ruleType === 'daily_limit' ? 'USDC' : '',
    allowedTokens: ruleType === 'token_restriction' ? 'USDC' : '',
    allowedRecipients: '',
  };
}

const RULE_TYPE_OPTIONS: { value: RuleType; label: string }[] = [
  { value: 'daily_limit', label: 'Daily Limit' },
  { value: 'token_restriction', label: 'Token Restriction' },
  { value: 'recipient_whitelist', label: 'Recipient Whitelist' },
];

function PolicyForm({ policyId, defaultValues }: PolicyFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PolicyFormValues>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      enabled: defaultValues?.enabled ?? true,
      rules: defaultValues?.rules?.length ? defaultValues.rules : [createDefaultRule()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rules',
  });

  const onSubmit = (values: PolicyFormValues) => {
    const parsed = policyFormSchema.parse(values);
    console.log('Policy builder submission', {
      policyId,
      name: parsed.name,
      description: parsed.description,
      enabled: parsed.enabled,
      rules: parsed.rules.map((rule) => {
        if (rule.ruleType === 'daily_limit') {
          return {
            id: rule.id,
            ruleType: rule.ruleType,
            maxAmount: Number(rule.maxAmount),
            asset: rule.asset,
          };
        }
        if (rule.ruleType === 'token_restriction') {
          return {
            id: rule.id,
            ruleType: rule.ruleType,
            allowedTokens: (rule.allowedTokens ?? '').split(',').map((token) => token.trim()).filter(Boolean),
          };
        }
        return {
          id: rule.id,
          ruleType: rule.ruleType,
          allowedRecipients: (rule.allowedRecipients ?? '').split(',').map((recipient) => recipient.trim()).filter(Boolean),
        };
      }),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-live="polite" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="mb-1.5 block text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
            Policy name
          </span>
          <Input
            {...register('name')}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'policy-name-error' : undefined}
            placeholder="e.g. Daily USDC cap"
          />
          {errors.name ? (
            <span id="policy-name-error" className="block text-xs text-danger">
              {errors.name.message}
            </span>
          ) : null}
        </label>
        <label className="space-y-1.5">
          <span className="mb-1.5 block text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
            Description
          </span>
          <Input {...register('description')} placeholder="Optional description" />
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('enabled')} className="h-4 w-4 rounded border-border" />
        Enabled
      </label>

      <div className="space-y-4">
        <SectionLabel>Rules</SectionLabel>
        {errors.rules?.message ? (
          <p className="text-xs text-danger" role="alert">{errors.rules.message}</p>
        ) : null}
        {fields.map((field, index) => {
          const ruleType = field.ruleType;
          return (
            <div key={field.id} className="rounded-card border border-border bg-surface/70 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <label className="space-y-1.5">
                  <span className="mb-1 block text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
                    Rule type
                  </span>
                  <select
                    {...register(`rules.${index}.ruleType`)}
                    className="h-9 rounded-md border border-border bg-surface px-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                  >
                    {RULE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {ruleType === 'daily_limit' ? (
                  <>
                    <label className="space-y-1.5">
                      <span className="mb-1 block text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
                        Daily cap
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        aria-invalid={Boolean(errors.rules?.[index]?.maxAmount)}
                        aria-describedby={errors.rules?.[index]?.maxAmount ? `rule-${index}-max-amount-error` : undefined}
                        {...register(`rules.${index}.maxAmount`)}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="mb-1 block text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
                        Asset
                      </span>
                      <Input
                        placeholder="USDC"
                        aria-invalid={Boolean(errors.rules?.[index]?.asset)}
                        aria-describedby={errors.rules?.[index]?.asset ? `rule-${index}-asset-error` : undefined}
                        {...register(`rules.${index}.asset`)}
                      />
                    </label>
                  </>
                ) : null}

                {ruleType === 'token_restriction' ? (
                  <label className="space-y-1.5">
                    <span className="mb-1 block text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
                      Allowed tokens
                    </span>
                    <Input
                      placeholder="USDC, XLM"
                      aria-invalid={Boolean(errors.rules?.[index]?.allowedTokens)}
                      aria-describedby={errors.rules?.[index]?.allowedTokens ? `rule-${index}-allowed-tokens-error` : undefined}
                      {...register(`rules.${index}.allowedTokens`)}
                    />
                  </label>
                ) : null}

                {ruleType === 'recipient_whitelist' ? (
                  <label className="space-y-1.5">
                    <span className="mb-1 block text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
                      Allowed recipients
                    </span>
                    <Input
                      placeholder="GABC..., GDEF..."
                      aria-invalid={Boolean(errors.rules?.[index]?.allowedRecipients)}
                      aria-describedby={errors.rules?.[index]?.allowedRecipients ? `rule-${index}-allowed-recipients-error` : undefined}
                      {...register(`rules.${index}.allowedRecipients`)}
                    />
                  </label>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-6"
                  onClick={() => remove(index)}
                >
                  Remove
                </Button>
              </div>

              <div className="mt-3 space-y-1.5">
                {errors.rules?.[index]?.maxAmount ? (
                  <p id={`rule-${index}-max-amount-error`} className="text-xs text-danger">
                    {errors.rules[index]?.maxAmount?.message}
                  </p>
                ) : null}
                {errors.rules?.[index]?.asset ? (
                  <p id={`rule-${index}-asset-error`} className="text-xs text-danger">
                    {errors.rules[index]?.asset?.message}
                  </p>
                ) : null}
                {errors.rules?.[index]?.allowedTokens ? (
                  <p id={`rule-${index}-allowed-tokens-error`} className="text-xs text-danger">
                    {errors.rules[index]?.allowedTokens?.message}
                  </p>
                ) : null}
                {errors.rules?.[index]?.allowedRecipients ? (
                  <p id={`rule-${index}-allowed-recipients-error`} className="text-xs text-danger">
                    {errors.rules[index]?.allowedRecipients?.message}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(createDefaultRule())}
        >
          Add rule
        </Button>
      </div>

      <Button type="submit" variant="gold">
        Save policy
      </Button>
    </form>
  );
}

function SimulationResult({ result }: { result: PolicySimulationResult }) {
  const outcome = outcomeMeta[result.predictedOutcome];
  return (
    <div className="space-y-5 rounded-card border border-border bg-surface/70 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={outcome.variant} dot>
          {outcome.label}
        </Badge>
        <span
          className={`inline-flex items-center gap-1 text-2xs font-medium ${
            result.passed ? 'text-success' : 'text-danger'
          }`}
        >
          {result.passed ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <X className="h-3.5 w-3.5" aria-hidden />
          )}
          {result.passed ? 'Passes all policies' : 'Blocked by policy'}
        </span>
      </div>

      <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        <KeyValue label="Estimated risk">
          <RiskBadge score={result.estimatedRisk} showScore />
        </KeyValue>
        <KeyValue label="Required approvals">
          <AnimatedNumber value={result.requiredApprovals} formatter={(v) => formatNumber(v)} />
        </KeyValue>
        <KeyValue label="Budget">{result.budgetImpact.name}</KeyValue>
        <KeyValue label="Remaining after">
          <AnimatedNumber value={result.budgetImpact.remainingAfter} formatter={(v) => formatCurrency(v, 'USDC')} />
        </KeyValue>
      </dl>

      {result.triggeredPolicies.length > 0 && (
        <div className="space-y-2">
          <p className="text-2xs font-medium uppercase tracking-wide text-foreground-secondary">
            Triggered policies
          </p>
          <ul className="space-y-1.5">
            {result.triggeredPolicies.map((tp) => (
              <li
                key={tp.policyId}
                className="flex items-center justify-between rounded-sm border border-border bg-surface px-3 py-2 text-xs"
              >
                <span className="text-foreground">{tp.name}</span>
                <span
                  className={`inline-flex items-center gap-1 text-2xs font-medium ${
                    tp.passed ? 'text-success' : 'text-danger'
                  }`}
                >
                  {tp.passed ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <X className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {tp.passed ? 'Pass' : 'Fail'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

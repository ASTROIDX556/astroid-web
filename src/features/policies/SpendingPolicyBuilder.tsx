'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField, Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { isValidStellarPublicKey } from '@/stores/freighter-store';

const validAddressList = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

export const spendingPolicySchema = z.object({
  name: z.string().trim().min(3, 'Policy name must be at least 3 characters.'),
  rules: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('spendLimit'),
        maxSingleTransactionLimit: z.coerce.number().positive('Maximum single transaction must be greater than zero.'),
        rollingBudgetLimit: z.coerce.number().positive('Rolling budget must be greater than zero.'),
        rollingBudgetInterval: z.enum(['daily', 'weekly', 'monthly']),
      }),
      z.object({
        type: z.literal('tokenRestriction'),
        allowedAssets: z.string().trim().refine((value) => {
          const assets = value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
          return assets.length > 0 && assets.every((asset) => /^[A-Za-z0-9]{1,12}$/.test(asset));
        }, 'At least one valid asset code is required.'),
      }),
      z.object({
        type: z.literal('recipientWhitelist'),
        whitelistAddresses: z
          .string()
          .trim()
          .refine((value) => {
            const addresses = validAddressList(value);
            if (addresses.length === 0) return false;
            return addresses.every((address) => isValidStellarPublicKey(address));
          }, 'At least one valid Stellar public key is required.'),
      }),
    ])
  ).min(1, 'At least one rule is required.'),
});

export { spendingPolicySchema as policySchema };

export type SpendingPolicy = z.infer<typeof spendingPolicySchema>;
export type SpendingPolicyRule = SpendingPolicy['rules'][number];
export type SpendingPolicyFormValues = SpendingPolicy;

export function SpendingPolicyBuilder() {
  const form = useForm<SpendingPolicyFormValues>({
    resolver: zodResolver(spendingPolicySchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      name: 'Treasury burn guard',
      rules: [
        {
          type: 'spendLimit',
          maxSingleTransactionLimit: 2000,
          rollingBudgetLimit: 20000,
          rollingBudgetInterval: 'weekly',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'rules',
  });

  const watchedRules = form.watch('rules');

  const preview = useMemo(() => {
    const values = form.getValues();
    return {
      policyName: values.name,
      rules: values.rules.map((rule) => {
        switch (rule.type) {
          case 'spendLimit':
            return {
              type: 'spendLimit',
              maxSingleTransactionLimit: Number(rule.maxSingleTransactionLimit),
              rollingBudget: {
                limit: Number(rule.rollingBudgetLimit),
                interval: rule.rollingBudgetInterval,
              },
            };
          case 'tokenRestriction':
            return {
              type: 'tokenRestriction',
              allowedAssets: rule.allowedAssets
                .split(',')
                .map((asset) => asset.trim())
                .filter(Boolean),
            };
          case 'recipientWhitelist':
            return {
              type: 'recipientWhitelist',
              whitelistAddresses: validAddressList(rule.whitelistAddresses).filter(Boolean),
            };
          default:
            return rule;
        }
      }),
    };
  }, [form, watchedRules]);

  const submitForm = (values: SpendingPolicyFormValues) => {
    // Intentionally no backend write here; the feature is a form preview and validation pass-through.
    console.info('Spending policy validated', values);
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border bg-surface-secondary/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-foreground-secondary">Policy builder</p>
            <h3 className="mt-1 font-display text-xl font-semibold tracking-tight">Spending guardrail configuration</h3>
          </div>
          <Badge variant="gold" size="sm" className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Live validation
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1.4fr_0.9fr]">
        <form className="space-y-5" onSubmit={form.handleSubmit(submitForm)} noValidate>
          <div className="grid gap-4">
            <FormField label="Policy Name" required error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} placeholder="Treasury burn guard" />
            </FormField>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-2xs font-medium uppercase tracking-[0.18em] text-foreground-secondary">Policy rules</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                append({
                  type: 'spendLimit',
                  maxSingleTransactionLimit: 1000,
                  rollingBudgetLimit: 10000,
                  rollingBudgetInterval: 'daily',
                })
              }
            >
              Add rule
            </Button>
          </div>

          <div className="space-y-4" aria-live="polite">
            {fields.map((field, index) => {
              const ruleType = watchedRules?.[index]?.type ?? 'spendLimit';
              const ruleErrors = (form.formState.errors.rules?.[index] ?? {}) as Record<string, { message?: string }>;

              return (
                <Card key={field.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <FormField label="Rule Type" required error={ruleErrors.type?.message}>
                        <select
                          {...form.register(`rules.${index}.type` as any)}
                          className={cn(
                            'h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            ruleErrors.type && 'border-danger',
                          )}
                        >
                          <option value="spendLimit">Spend Limit</option>
                          <option value="tokenRestriction">Token Restriction</option>
                          <option value="recipientWhitelist">Recipient Whitelist</option>
                        </select>
                      </FormField>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => remove(index)}
                      aria-label="Remove rule"
                    >
                      Remove
                    </Button>
                  </div>

                  {ruleType === 'spendLimit' && (
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <FormField
                        label="Maximum Single Transaction Limit"
                        required
                        error={ruleErrors.maxSingleTransactionLimit?.message}
                      >
                        <Input
                          {...form.register(`rules.${index}.maxSingleTransactionLimit` as any)}
                          type="number"
                          inputMode="decimal"
                          min={0.01}
                          step="0.01"
                          placeholder="2500"
                        />
                      </FormField>
                      <FormField
                        label="Rolling Budget Limit"
                        required
                        error={ruleErrors.rollingBudgetLimit?.message}
                      >
                        <Input
                          {...form.register(`rules.${index}.rollingBudgetLimit` as any)}
                          type="number"
                          inputMode="decimal"
                          min={0.01}
                          step="0.01"
                          placeholder="20000"
                        />
                      </FormField>
                      <FormField
                        label="Budget Interval"
                        required
                        error={ruleErrors.rollingBudgetInterval?.message}
                      >
                        <select
                          {...form.register(`rules.${index}.rollingBudgetInterval` as any)}
                          className={cn(
                            'h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            ruleErrors.rollingBudgetInterval && 'border-danger',
                          )}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </FormField>
                    </div>
                  )}

                  {ruleType === 'tokenRestriction' && (
                    <div className="mt-4">
                      <FormField
                        label="Allowed Assets"
                        hint="Comma-separated asset codes"
                        required
                        error={ruleErrors.allowedAssets?.message}
                      >
                        <Input
                          {...form.register(`rules.${index}.allowedAssets` as any)}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="XLM, USDC, EURC"
                        />
                      </FormField>
                    </div>
                  )}

                  {ruleType === 'recipientWhitelist' && (
                    <div className="mt-4">
                      <FormField
                        label="Whitelist Addresses"
                        hint="Comma-separated Stellar G-addresses"
                        required
                        error={ruleErrors.whitelistAddresses?.message}
                      >
                        <Input
                          {...form.register(`rules.${index}.whitelistAddresses` as any)}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="GABC...XYZ, GDEF...LMN"
                        />
                      </FormField>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="secondary" onClick={() => form.reset()}>
              Reset
            </Button>
            <Button type="submit" variant="gold" leftIcon={<ShieldCheck className="h-4 w-4" aria-hidden />}>
              Validate policy
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="rounded-card border border-border bg-surface-secondary/30 p-4">
            <div className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.18em] text-foreground-secondary">
              <WalletCards className="h-3.5 w-3.5" aria-hidden />
              JSON preview
            </div>
            <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-surface p-3 text-xs text-foreground">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </Card>
  );
}

export { SpendingPolicyBuilder as PolicyForm };

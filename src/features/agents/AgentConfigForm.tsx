'use client';

import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, Gauge, Link2, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FormField, Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import {
  AGENT_PERMISSION_SCOPES,
  PERMISSION_SCOPE_DESCRIPTIONS,
  PERMISSION_SCOPE_LABELS,
  agentConfigurationSchema,
  type AgentConfigurationValues,
} from '@/lib/validations/agent';
import {
  AGENT_PROVIDER_IDS,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  requiresEndpoint,
} from './schema';

/**
 * Controlled agent configuration form with provider-specific validation,
 * spending limits, and explicitly granted permission scopes.
 */
export function AgentConfigForm() {
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<AgentConfigurationValues>({
    resolver: zodResolver(agentConfigurationSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      description: '',
      provider: 'Nvidia',
      model: 'meta/llama-3.1-405b-instruct',
      endpointUrl: '',
      mode: 'assisted',
      temperature: 0.2,
      monthlyBudget: 500,
      dailySpendingLimit: 100,
      capabilities: ['wallet.read', 'analytics.read'],
    },
  });

  const provider = watch('provider');
  const model = watch('model');

  // Model options flip with the provider; `Custom` offers a free-form model id.
  const modelOptions = useMemo(() => PROVIDER_MODELS[provider], [provider]);
  const needsEndpoint = requiresEndpoint(provider);
  const isCustomModel = provider === 'Custom';

  // Graceful provider switch: reset the model to the new provider's first
  // option (or empty for custom) and clear the now-hidden endpoint field's
  // validation state so stale errors never block submission.
  useEffect(() => {
    if (isCustomModel) {
      if (model) setValue('model', '');
      setValue('endpointUrl', '');
      return;
    }
    if (!modelOptions.includes(model)) {
      setValue('model', modelOptions[0] ?? '');
      if (errors.model) trigger('model');
    }
    if (!needsEndpoint && errors.endpointUrl) {
      // Field is now hidden and empty; re-run validation to drop the stale error.
      setValue('endpointUrl', '');
      trigger('endpointUrl');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const onSubmit = (values: AgentConfigurationValues) => {
    // Mock-mode deployment: the API contract is defined in astroid-api
    // (POST /agents); wire the payload there once the backend ships.
    toast.success(`${values.name} configured`, {
      description: `${PROVIDER_LABELS[values.provider]} · ${values.model || 'custom model'} · ${values.capabilities.length} scope${values.capabilities.length === 1 ? '' : 's'} deployed to the Stellar testnet control plane.`,
    });
    reset();
  };

  return (
    <Card className="p-6">
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        aria-label="Agent configuration"
        className="space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-button bg-gold-soft text-gold-strong">
              <Bot className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                Configure agent
              </h3>
              <p className="text-2xs text-foreground-muted">
                Pick a provider, model, and the scopes the agent may use.
              </p>
            </div>
          </div>
          <Badge variant="outline" size="sm" className="font-mono">
            form v3 · zod-validated
          </Badge>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Agent name"
            htmlFor="agent-config-name"
            required
            error={errors.name?.message}
          >
            <Input
              id="agent-config-name"
              placeholder="e.g. Treasury Rebalancer"
              invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'agent-config-name-error' : undefined}
              {...register('name')}
            />
          </FormField>

          <FormField
            label="Provider"
            htmlFor="agent-config-provider"
            required
            error={errors.provider?.message}
            hint="Model options update to match the selected provider."
          >
            <Select
              id="agent-config-provider"
              invalid={Boolean(errors.provider)}
              aria-describedby={
                errors.provider ? 'agent-config-provider-error' : undefined
              }
              {...register('provider')}
            >
              {AGENT_PROVIDER_IDS.map((id) => (
                <option key={id} value={id}>
                  {PROVIDER_LABELS[id]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField
          label={isCustomModel ? 'Custom model identifier' : 'Model'}
          htmlFor="agent-config-model"
          required
          error={errors.model?.message}
          hint={
            isCustomModel
              ? 'Any deployment id exposed by your endpoint.'
              : `${modelOptions.length} models available for ${PROVIDER_LABELS[provider]}.`
          }
        >
          {isCustomModel ? (
            <Input
              id="agent-config-model"
              placeholder="e.g. my-org/finance-agent-v1"
              invalid={Boolean(errors.model)}
              aria-describedby={errors.model ? 'agent-config-model-error' : undefined}
              {...register('model')}
            />
          ) : (
            <Select
              id="agent-config-model"
              invalid={Boolean(errors.model)}
              aria-describedby={errors.model ? 'agent-config-model-error' : undefined}
              {...register('model')}
            >
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {needsEndpoint && (
          <FormField
            label="API endpoint URL"
            htmlFor="agent-config-endpoint"
            required
            error={errors.endpointUrl?.message}
            hint={
              provider === 'Ollama'
                ? 'e.g. http://localhost:11434 for a local Ollama runtime.'
                : 'Base URL of the OpenAI-compatible inference server.'
            }
          >
            <Input
              id="agent-config-endpoint"
              type="url"
              inputMode="url"
              placeholder="https://inference.example.com/v1"
              leftIcon={<Link2 className="h-4 w-4" aria-hidden />}
              invalid={Boolean(errors.endpointUrl)}
              aria-describedby={
                errors.endpointUrl ? 'agent-config-endpoint-error' : undefined
              }
              {...register('endpointUrl')}
            />
          </FormField>
        )}

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <FormField
            label="Operating mode"
            htmlFor="agent-config-mode"
            required
            error={errors.mode?.message}
          >
            <Select
              id="agent-config-mode"
              invalid={Boolean(errors.mode)}
              aria-describedby={errors.mode ? 'agent-config-mode-error' : undefined}
              {...register('mode')}
            >
              <option value="assisted">Assisted</option>
              <option value="autonomous">Autonomous</option>
            </Select>
          </FormField>

          <FormField
            label="Temperature"
            htmlFor="agent-config-temperature"
            required
            error={errors.temperature?.message}
            hint="0 – 2 · sampling creativity"
          >
            <Input
              id="agent-config-temperature"
              type="number"
              step="0.1"
              min={0}
              max={2}
              invalid={Boolean(errors.temperature)}
              aria-describedby={
                errors.temperature ? 'agent-config-temperature-error' : undefined
              }
              {...register('temperature', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Monthly budget (USDC)"
            htmlFor="agent-config-budget"
            required
            error={errors.monthlyBudget?.message}
          >
            <Input
              id="agent-config-budget"
              type="number"
              min={1}
              step="1"
              invalid={Boolean(errors.monthlyBudget)}
              aria-describedby={
                errors.monthlyBudget ? 'agent-config-budget-error' : undefined
              }
              leftIcon={<Gauge className="h-4 w-4" aria-hidden />}
              {...register('monthlyBudget', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Daily spending limit (USDC)"
            htmlFor="agent-config-daily-limit"
            required
            error={errors.dailySpendingLimit?.message}
            hint="Cannot exceed the monthly budget"
          >
            <Input
              id="agent-config-daily-limit"
              type="number"
              min={1}
              step="1"
              invalid={Boolean(errors.dailySpendingLimit)}
              aria-describedby={
                errors.dailySpendingLimit ? 'agent-config-daily-limit-error' : undefined
              }
              leftIcon={<ShieldCheck className="h-4 w-4" aria-hidden />}
              {...register('dailySpendingLimit', { valueAsNumber: true })}
            />
          </FormField>
        </div>

        <FormField
          label="Permission scopes"
          htmlFor="agent-config-capabilities"
          required
          error={errors.capabilities?.message}
          hint="Only the granted scopes may be exercised by the agent."
        >
          <Controller
            control={control}
            name="capabilities"
            render={({ field }) => (
              <div
                id="agent-config-capabilities"
                role="group"
                aria-label="Permission scopes"
                aria-describedby={
                  errors.capabilities ? 'agent-config-capabilities-error' : undefined
                }
                className="grid gap-2 sm:grid-cols-2"
              >
                {AGENT_PERMISSION_SCOPES.map((scope) => {
                  const checked = field.value.includes(scope);
                  return (
                    <label
                      key={scope}
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-button border p-2.5 text-xs transition-colors duration-fast',
                        checked
                          ? 'border-gold bg-gold-soft/40'
                          : 'border-border bg-surface hover:bg-surface-secondary',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        aria-invalid={Boolean(errors.capabilities)}
                        onChange={(event) => {
                          field.onChange(
                            event.target.checked
                              ? [...field.value, scope]
                              : field.value.filter((value) => value !== scope),
                          );
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                      />
                      <span className="space-y-0.5">
                        <span className="block font-medium text-foreground">
                          {PERMISSION_SCOPE_LABELS[scope]}
                        </span>
                        <span className="block text-2xs text-foreground-secondary">
                          {PERMISSION_SCOPE_DESCRIPTIONS[scope]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          />
        </FormField>

        <FormField
          label="Description"
          htmlFor="agent-config-description"
          error={errors.description?.message}
          hint="Optional · shown on the agent detail page."
        >
          <Input
            id="agent-config-description"
            placeholder="What does this agent do?"
            invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? 'agent-config-description-error' : undefined
            }
            {...register('description')}
          />
        </FormField>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => reset()}>
            Reset
          </Button>
          <Button
            type="submit"
            variant="gold"
            size="sm"
            loading={isSubmitting}
            leftIcon={isSubmitSuccessful ? undefined : <Sparkles className="h-4 w-4" />}
          >
            Deploy agent
          </Button>
        </div>
      </form>
    </Card>
  );
}

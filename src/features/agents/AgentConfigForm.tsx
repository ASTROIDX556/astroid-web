'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, Gauge, Link2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FormField, Input, Select } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  AGENT_PROVIDER_IDS,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  agentConfigSchema,
  requiresEndpoint,
  type AgentConfigFormValues,
} from './schema';

/**
 * Controlled agent configuration form. Model options are derived from the
 * selected provider, and switching providers resets the model (and clears
 * stale endpoint errors) so only valid configurations can be submitted.
 */
export function AgentConfigForm() {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<AgentConfigFormValues>({
    resolver: zodResolver(agentConfigSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      description: '',
      provider: 'Nvidia',
      model: 'meta/llama-3.1-405b-instruct',
      endpointUrl: '',
      mode: 'assisted',
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 4096,
      monthlyBudget: 500,
    },
  });

  const provider = watch('provider');
  const model = watch('model');
  const temperature = watch('temperature');
  const topP = watch('topP');
  const maxTokens = watch('maxTokens');

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

  const onSubmit = (values: AgentConfigFormValues) => {
    // Mock-mode deployment: the API contract is defined in astroid-api
    // (POST /agents); wire the payload there once the backend ships.
    toast.success(`${values.name} configured`, {
      description: `${PROVIDER_LABELS[values.provider]} · ${values.model || 'custom model'} deployed to the Stellar testnet control plane.`,
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
                Pick a provider, then a model from its catalog before deployment.
              </p>
            </div>
          </div>
          <Badge variant="outline" size="sm" className="font-mono">
            form v2 · validated
          </Badge>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Agent name" required error={errors.name?.message}>
            <Input
              id="agent-name"
              placeholder="e.g. Treasury Rebalancer"
              invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'agent-name-error' : undefined}
              {...register('name')}
            />
          </FormField>

          <FormField
            label="Provider"
            required
            error={errors.provider?.message}
            hint="Model options update to match the selected provider."
          >
            <Select
              id="agent-provider"
              invalid={Boolean(errors.provider)}
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
              id="agent-model"
              placeholder="e.g. my-org/finance-agent-v1"
              invalid={Boolean(errors.model)}
              {...register('model')}
            />
          ) : (
            <Select
              id="agent-model"
              invalid={Boolean(errors.model)}
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
            required
            error={errors.endpointUrl?.message}
            hint={
              provider === 'Ollama'
                ? 'e.g. http://localhost:11434 for a local Ollama runtime.'
                : 'Base URL of the OpenAI-compatible inference server.'
            }
          >
            <Input
              id="agent-endpoint"
              type="url"
              inputMode="url"
              placeholder="https://inference.example.com/v1"
              leftIcon={<Link2 className="h-4 w-4" aria-hidden />}
              invalid={Boolean(errors.endpointUrl)}
              {...register('endpointUrl')}
            />
          </FormField>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Operating mode" required error={errors.mode?.message}>
            <Select id="agent-mode" invalid={Boolean(errors.mode)} {...register('mode')}>
              <option value="assisted">Assisted</option>
              <option value="autonomous">Autonomous</option>
            </Select>
          </FormField>

          <FormField
            label="Temperature"
            required
            error={errors.temperature?.message}
            hint={`${Number(temperature).toFixed(1)} · 0 – 2`}
          >
            <input
              id="agent-temperature"
              type="range"
              min={0}
              max={2}
              step="0.1"
              aria-valuetext={Number(temperature).toFixed(1)}
              aria-invalid={Boolean(errors.temperature)}
              className="h-10 w-full accent-gold"
              {...register('temperature', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Top-p"
            required
            error={errors.topP?.message}
            hint={`${Number(topP).toFixed(2)} · 0 – 1`}
          >
            <input
              id="agent-top-p"
              type="range"
              min={0}
              max={1}
              step="0.01"
              aria-valuetext={Number(topP).toFixed(2)}
              className="h-10 w-full accent-gold"
              {...register('topP', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Maximum tokens"
            required
            error={errors.maxTokens?.message}
            hint={`${Number(maxTokens).toLocaleString()} · 256 – 32,768`}
          >
            <input
              id="agent-max-tokens"
              type="range"
              min={256}
              max={32768}
              step={256}
              aria-valuetext={Number(maxTokens).toLocaleString()}
              className="h-10 w-full accent-gold"
              {...register('maxTokens', { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Monthly budget (USDC)"
            required
            error={errors.monthlyBudget?.message}
          >
            <Input
              id="agent-budget"
              type="number"
              min={1}
              step="1"
              invalid={Boolean(errors.monthlyBudget)}
              leftIcon={<Gauge className="h-4 w-4" aria-hidden />}
              {...register('monthlyBudget', { valueAsNumber: true })}
            />
          </FormField>
        </div>

        <FormField
          label="Description"
          error={errors.description?.message}
          hint="Optional · shown on the agent detail page."
        >
          <Input
            id="agent-description"
            placeholder="What does this agent do?"
            invalid={Boolean(errors.description)}
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

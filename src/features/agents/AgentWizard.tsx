'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, Input, Select, Textarea } from '@/components/ui/input';
import { agentWizardSchema, providerOptions, type AgentWizardValues } from '@/features/agents/schema';

const steps = [
  { key: 'basic', label: 'Basic info' },
  { key: 'model', label: 'Model selection' },
  { key: 'funding', label: 'Funding & limits' },
  { key: 'confirmation', label: 'Confirmation' },
] as const;

const stepFields: Record<number, (keyof AgentWizardValues)[]> = {
  0: ['name', 'description', 'ownerDepartment'],
  1: ['provider', 'model', 'apiKey'],
  2: ['budget', 'singleTransactionCap'],
  3: [],
};

export function AgentWizard() {
  const [step, setStep] = useState(0);
  const form = useForm<AgentWizardValues>({
    resolver: zodResolver(agentWizardSchema),
    defaultValues: {
      name: '',
      description: '',
      ownerDepartment: '',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      apiKey: '',
      budget: 5000,
      singleTransactionCap: 1500,
    },
    mode: 'onChange',
  });

  const currentStep = useMemo(() => steps[step] ?? steps[0], [step]);

  const handleNext = async () => {
    const fields = stepFields[step] ?? [];
    if (!fields.length) {
      setStep((value) => Math.min(value + 1, steps.length - 1));
      return;
    }

    const valid = await form.trigger(fields);
    if (!valid) return;

    setStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const onSubmit = (values: AgentWizardValues) => {
    console.info('Agent registration payload', values);
    setStep(steps.length - 1);
  };

  return (
    <Card className="overflow-hidden border border-border bg-surface/80">
      <CardHeader className="border-b border-border bg-surface/60">
        <CardTitle className="flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-gold" aria-hidden />
          Register autonomous agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <div className="flex flex-wrap gap-2">
          {steps.map((item, index) => (
            <span
              key={item.key}
              className={`rounded-full border px-2.5 py-1 text-2xs font-medium ${
                index === step
                  ? 'border-gold bg-gold-soft text-gold-strong'
                  : 'border-border bg-surface-secondary text-foreground-secondary'
              }`}
            >
              {item.label}
            </span>
          ))}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {step === 0 && (
            <div className="space-y-4">
              <FormField label="Agent name" htmlFor="agent-name" error={form.formState.errors.name?.message} required>
                <Input
                  id="agent-name"
                  {...form.register('name')}
                  placeholder="Treasury Copilot"
                  invalid={Boolean(form.formState.errors.name)}
                />
              </FormField>

              <FormField
                label="Description"
                htmlFor="agent-description"
                error={form.formState.errors.description?.message}
                required
              >
                <Textarea
                  id="agent-description"
                  {...form.register('description')}
                  placeholder="Monitors treasury balances and flags unusual payment anomalies."
                  invalid={Boolean(form.formState.errors.description)}
                />
              </FormField>

              <FormField
                label="Owner department"
                htmlFor="department"
                error={form.formState.errors.ownerDepartment?.message}
                required
              >
                <Input
                  id="department"
                  {...form.register('ownerDepartment')}
                  placeholder="Finance Operations"
                  invalid={Boolean(form.formState.errors.ownerDepartment)}
                />
              </FormField>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <FormField label="Model provider" htmlFor="provider" error={form.formState.errors.provider?.message} required>
                <Select id="provider" {...form.register('provider')} invalid={Boolean(form.formState.errors.provider)}>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Model/version" htmlFor="model" error={form.formState.errors.model?.message} required>
                <Input
                  id="model"
                  {...form.register('model')}
                  placeholder="gpt-4.1-mini"
                  invalid={Boolean(form.formState.errors.model)}
                />
              </FormField>

              <FormField label="Provider key" htmlFor="api-key" error={form.formState.errors.apiKey?.message}>
                <Input
                  id="api-key"
                  type="password"
                  {...form.register('apiKey')}
                  placeholder="Optional provider secret"
                  invalid={Boolean(form.formState.errors.apiKey)}
                />
              </FormField>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <FormField label="Initial budget (XLM)" htmlFor="budget" error={form.formState.errors.budget?.message} required>
                <Input
                  id="budget"
                  type="number"
                  step="0.01"
                  {...form.register('budget')}
                  invalid={Boolean(form.formState.errors.budget)}
                />
              </FormField>

              <FormField
                label="Single transaction cap (XLM)"
                htmlFor="singleTransactionCap"
                error={form.formState.errors.singleTransactionCap?.message}
                required
              >
                <Input
                  id="singleTransactionCap"
                  type="number"
                  step="0.01"
                  {...form.register('singleTransactionCap')}
                  invalid={Boolean(form.formState.errors.singleTransactionCap)}
                />
              </FormField>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 rounded-card border border-border bg-surface-secondary p-4">
              <h3 className="text-sm font-medium text-foreground">Review and confirm</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">Name</dt>
                  <dd className="mt-1 text-sm text-foreground">{form.watch('name')}</dd>
                </div>
                <div>
                  <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">Department</dt>
                  <dd className="mt-1 text-sm text-foreground">{form.watch('ownerDepartment')}</dd>
                </div>
                <div>
                  <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">Provider</dt>
                  <dd className="mt-1 text-sm text-foreground">{form.watch('provider')}</dd>
                </div>
                <div>
                  <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">Model</dt>
                  <dd className="mt-1 text-sm text-foreground">{form.watch('model')}</dd>
                </div>
                <div>
                  <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">Budget</dt>
                  <dd className="mt-1 text-sm text-foreground">{form.watch('budget')} XLM</dd>
                </div>
                <div>
                  <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">Cap</dt>
                  <dd className="mt-1 text-sm text-foreground">{form.watch('singleTransactionCap')} XLM</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((value) => Math.max(value - 1, 0))}
              disabled={step === 0}
              leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
            >
              Back
            </Button>

            {step < steps.length - 1 ? (
              <Button type="button" variant="gold" onClick={handleNext} rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                {currentStep.label === 'Confirmation' ? 'Review' : 'Next'}
              </Button>
            ) : (
              <Button type="submit" variant="gold">
                Launch agent
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

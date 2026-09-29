'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Layers,
  Settings,
  Shield,
  ClipboardCheck,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, Input, Select, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import {
  templateWizardSchema,
  WIZARD_STEPS,
  STEP_FIELDS,
  type TemplateWizardValues,
} from '../templateWizardSchema';
import { AGENT_TEMPLATES, getTemplateById, type AgentTemplate } from '../templates';

/* ------------------------------------------------------------------ */
/*  Slide animation variants                                          */
/* ------------------------------------------------------------------ */

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const NETWORK_OPTIONS = ['Stellar Mainnet', 'Stellar Testnet', 'Stellar Futurenet'] as const;

const STEP_ICONS = [Layers, Settings, Shield, ClipboardCheck];

/* ------------------------------------------------------------------ */
/*  Step 0 — Template Selection                                       */
/* ------------------------------------------------------------------ */

function TemplateSelectionStep({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4" role="radiogroup" aria-label="Select an agent template">
      <p className="text-xs text-foreground-secondary">
        Choose a preset template to auto-fill configuration values. You can customize everything in the next step.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AGENT_TEMPLATES.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            selected={selectedId === tpl.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: AgentTemplate;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(template.id)}
      className={cn(
        'group flex flex-col items-start gap-3 rounded-card border p-4 text-left transition-all duration-fast',
        selected
          ? 'border-gold bg-gold-soft/50 shadow-gold'
          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-secondary',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-xl" aria-hidden>
          {template.icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{template.name}</p>
          <Badge variant="outline" size="sm" className="mt-0.5">
            {template.category}
          </Badge>
        </div>
      </div>

      <p className="text-2xs leading-relaxed text-foreground-secondary line-clamp-2">
        {template.description}
      </p>

      <div className="flex items-center gap-3 text-2xs text-foreground-muted">
        <span>{template.defaults.provider}</span>
        <span>·</span>
        <span>{template.defaults.model}</span>
        <span>·</span>
        <span>≤${template.maxHourlyBudgetUsd}/hr</span>
      </div>

      {selected && (
        <div className="flex items-center gap-1 text-2xs font-medium text-gold-strong">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Selected
        </div>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Policies                                                 */
/* ------------------------------------------------------------------ */

function PoliciesStep() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-foreground-secondary">
        Set spending limits and network preferences. These can be adjusted later from the agent settings.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Initial budget (XLM)"
          htmlFor="tpl-budget"
          error={undefined}
          required
        >
          <Input id="tpl-budget" type="number" step="0.01" placeholder="10000" />
        </FormField>

        <FormField
          label="Single transaction cap (XLM)"
          htmlFor="tpl-singleTransactionCap"
          error={undefined}
          required
        >
          <Input id="tpl-singleTransactionCap" type="number" step="0.01" placeholder="2000" />
        </FormField>

        <FormField
          label="Max hourly spend (USD)"
          htmlFor="tpl-maxHourlyBudgetUsd"
          error={undefined}
          required
        >
          <Input id="tpl-maxHourlyBudgetUsd" type="number" step="0.01" placeholder="50" />
        </FormField>

        <FormField
          label="Require approval above (XLM)"
          htmlFor="tpl-requireApprovalAbove"
          error={undefined}
        >
          <Input id="tpl-requireApprovalAbove" type="number" step="0.01" placeholder="5000" />
        </FormField>
      </div>

      <FormField label="Allowed networks" htmlFor="tpl-networks" required>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Select allowed networks">
          {NETWORK_OPTIONS.map((net) => (
            <Controller
              key={net}
              name="allowedNetworks"
              render={({ field }) => {
                const checked = field.value?.includes(net) ?? false;
                return (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => {
                      const next = checked
                        ? field.value.filter((v: string) => v !== net)
                        : [...(field.value ?? []), net];
                      field.onChange(next);
                    }}
                    className={cn(
                      'rounded-button border px-3 py-1.5 text-xs font-medium transition-colors',
                      checked
                        ? 'border-gold bg-gold-soft text-gold-strong'
                        : 'border-border bg-surface text-foreground-secondary hover:bg-surface-secondary',
                    )}
                  >
                    {net}
                  </button>
                );
              }}
            />
          ))}
        </div>
      </FormField>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Confirmation                                             */
/* ------------------------------------------------------------------ */

function ConfirmationStep({ values }: { values: TemplateWizardValues }) {
  const tpl = getTemplateById(values.templateId);
  return (
    <div className="space-y-4 rounded-card border border-border bg-surface-secondary p-4">
      <h3 className="text-sm font-medium text-foreground">Review &amp; confirm</h3>

      <dl className="grid gap-3 sm:grid-cols-2">
        <ReviewField label="Template" value={tpl?.name ?? '—'} />
        <ReviewField label="Agent name" value={values.name} />
        <ReviewField label="Department" value={values.ownerDepartment} />
        <ReviewField label="Provider" value={values.provider} />
        <ReviewField label="Model" value={values.model} />
        <ReviewField label="Budget" value={`${values.budget.toLocaleString()} XLM`} />
        <ReviewField label="Tx cap" value={`${values.singleTransactionCap.toLocaleString()} XLM`} />
        <ReviewField label="Hourly cap" value={`$${values.maxHourlyBudgetUsd}/hr`} />
        <ReviewField
          label="Approval threshold"
          value={`${values.requireApprovalAbove.toLocaleString()} XLM`}
        />
        <ReviewField
          label="Networks"
          value={values.allowedNetworks?.join(', ') ?? '—'}
          span
        />
      </dl>
    </div>
  );
}

function ReviewField({
  label,
  value,
  span,
}: {
  label: string;
  value: string;
  span?: boolean;
}) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <dt className="text-2xs uppercase tracking-wide text-foreground-secondary">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Wizard                                                       */
/* ------------------------------------------------------------------ */

export function AgentTemplateWizard() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const stepRef = useRef<HTMLDivElement>(null);

  const currentStep = WIZARD_STEPS[step] ?? WIZARD_STEPS[0];

  const form = useForm<TemplateWizardValues>({
    resolver: zodResolver(templateWizardSchema),
    defaultValues: {
      templateId: '',
      name: '',
      description: '',
      ownerDepartment: '',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      apiKey: '',
      budget: 5000,
      singleTransactionCap: 1500,
      maxHourlyBudgetUsd: 50,
      requireApprovalAbove: 5000,
      allowedNetworks: ['Stellar Mainnet'],
    },
    mode: 'onChange',
  });

  const selectedTemplateId = form.watch('templateId');
  const selectedTemplate = useMemo(
    () => (selectedTemplateId ? getTemplateById(selectedTemplateId) : undefined),
    [selectedTemplateId],
  );

  /** Apply template defaults when a template is selected. */
  const handleTemplateSelect = useCallback(
    (id: string) => {
      form.setValue('templateId', id, { shouldValidate: true });
      const tpl = getTemplateById(id);
      if (tpl?.defaults) {
        Object.entries(tpl.defaults).forEach(([key, value]) => {
          if (value !== undefined) {
            form.setValue(key as keyof TemplateWizardValues, value as never, {
              shouldValidate: false,
            });
          }
        });
        // Set hourly budget from template max
        form.setValue('maxHourlyBudgetUsd', tpl.maxHourlyBudgetUsd, { shouldValidate: false });
      }
    },
    [form],
  );

  /** Validate current step fields and advance. */
  const handleNext = useCallback(async () => {
    const fields = STEP_FIELDS[step] ?? [];
    if (fields.length === 0) {
      setDirection(1);
      setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
      return;
    }
    const valid = await form.trigger(fields);
    if (!valid) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }, [step, form]);

  const handleBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const onSubmit = useCallback(
    (values: TemplateWizardValues) => {
      console.info('Agent template wizard payload:', values);
      setDirection(1);
      setStep(WIZARD_STEPS.length - 1);
    },
    [],
  );

  /** Focus the step container on transition for screen readers. */
  useEffect(() => {
    stepRef.current?.focus();
  }, [step]);

  const isLastStep = step === WIZARD_STEPS.length - 1;

  return (
    <Card className="overflow-hidden border border-border bg-surface/80">
      <CardHeader className="border-b border-border bg-surface/60">
        <CardTitle className="flex items-center gap-2 text-sm text-foreground">
          <Sparkles className="h-4 w-4 text-gold" aria-hidden />
          Create agent from template
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {/* Step indicator */}
        <nav aria-label="Wizard progress">
          <ol className="flex flex-wrap gap-2" role="list">
            {WIZARD_STEPS.map((s, index) => {
              const Icon = STEP_ICONS[index] ?? Layers;
              const isActive = index === step;
              const isComplete = index < step;
              return (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
                      isActive
                        ? 'border-gold bg-gold-soft text-gold-strong'
                        : isComplete
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-border bg-surface-secondary text-foreground-secondary',
                    )}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                    ) : (
                      <Icon className="h-3 w-3" aria-hidden />
                    )}
                    {s.label}
                  </span>
                  {index < WIZARD_STEPS.length - 1 && (
                    <span className="text-foreground-muted" aria-hidden>
                      →
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Screen reader live region */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Step {step + 1} of {WIZARD_STEPS.length}: {currentStep.label}
        </div>

        {/* Animated step content */}
        <div
          ref={stepRef}
          tabIndex={-1}
          className="min-h-[320px] outline-none"
          role="region"
          aria-label={`Step ${step + 1}: ${currentStep.label}`}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep.key}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <form
                id="template-wizard-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                {step === 0 && (
                  <TemplateSelectionStep
                    selectedId={selectedTemplateId}
                    onSelect={handleTemplateSelect}
                  />
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs text-foreground-secondary">
                      {selectedTemplate
                        ? `Configuring ${selectedTemplate.name} — fields are pre-filled from the template. Adjust as needed.`
                        : 'Configure your agent settings.'}
                    </p>

                    <FormField
                      label="Agent name"
                      htmlFor="tpl-name"
                      error={form.formState.errors.name?.message}
                      required
                    >
                      <Input
                        id="tpl-name"
                        {...form.register('name')}
                        placeholder="My Arbitrage Bot"
                        invalid={Boolean(form.formState.errors.name)}
                      />
                    </FormField>

                    <FormField
                      label="Description"
                      htmlFor="tpl-description"
                      error={form.formState.errors.description?.message}
                      required
                    >
                      <Textarea
                        id="tpl-description"
                        {...form.register('description')}
                        placeholder="What does this agent do?"
                        invalid={Boolean(form.formState.errors.description)}
                      />
                    </FormField>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        label="Owner department"
                        htmlFor="tpl-department"
                        error={form.formState.errors.ownerDepartment?.message}
                        required
                      >
                        <Input
                          id="tpl-department"
                          {...form.register('ownerDepartment')}
                          placeholder="Finance Operations"
                          invalid={Boolean(form.formState.errors.ownerDepartment)}
                        />
                      </FormField>

                      <FormField
                        label="Model provider"
                        htmlFor="tpl-provider"
                        error={form.formState.errors.provider?.message}
                        required
                      >
                        <Select
                          id="tpl-provider"
                          {...form.register('provider')}
                          invalid={Boolean(form.formState.errors.provider)}
                        >
                          {(['OpenAI', 'Anthropic', 'Gemini', 'Nvidia', 'Ollama', 'Custom'] as const).map(
                            (p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ),
                          )}
                        </Select>
                      </FormField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        label="Model / version"
                        htmlFor="tpl-model"
                        error={form.formState.errors.model?.message}
                        required
                      >
                        <Input
                          id="tpl-model"
                          {...form.register('model')}
                          placeholder="gpt-4o-mini"
                          invalid={Boolean(form.formState.errors.model)}
                        />
                      </FormField>

                      <FormField
                        label="Provider API key (optional)"
                        htmlFor="tpl-apiKey"
                        error={form.formState.errors.apiKey?.message}
                      >
                        <Input
                          id="tpl-apiKey"
                          type="password"
                          {...form.register('apiKey')}
                          placeholder="Optional secret"
                          invalid={Boolean(form.formState.errors.apiKey)}
                        />
                      </FormField>
                    </div>
                  </div>
                )}

                {step === 2 && <PoliciesStep />}

                {step === 3 && <ConfirmationStep values={form.getValues()} />}
              </form>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Validation warnings */}
        {step > 0 && step < 3 && Object.keys(form.formState.errors).length > 0 && (
          <div className="flex items-center gap-2 rounded-button border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Please fix the validation errors before proceeding.
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleBack}
            disabled={step === 0}
            leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
          >
            Back
          </Button>

          {!isLastStep ? (
            <Button
              type="button"
              variant="gold"
              onClick={handleNext}
              rightIcon={<ArrowRight className="h-4 w-4" aria-hidden />}
            >
              Next
            </Button>
          ) : (
            <Button type="submit" form="template-wizard-form" variant="gold">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Launch agent
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

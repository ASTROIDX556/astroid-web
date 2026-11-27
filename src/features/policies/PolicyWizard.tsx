'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, Input, Select } from '@/components/ui/input';
import { StepIndicator } from './components/StepIndicator';
import { spendingPolicySchema, type SpendingPolicyFormValues } from './spendingPolicySchema';
import { PolicyTemplateModal } from './PolicyTemplateModal';
import { applyPolicyTemplate, type PolicyTemplate } from './policyTemplates';

const WIZARD_STEPS = [
  { key: 'basics', label: 'Basics & Limits' },
  { key: 'whitelist', label: 'Destination Whitelist' },
  { key: 'assets', label: 'Asset & Time' },
  { key: 'review', label: 'Review Policy' },
] as const;

const STEP_FIELDS: Record<number, (keyof SpendingPolicyFormValues)[]> = {
  0: ['name', 'maxSingleTransactionLimit', 'rollingBudgetLimit', 'rollingBudgetInterval'],
  1: ['whitelistAddresses'],
  2: ['allowedAssets'],
  3: [],
};

export interface PolicyWizardProps {
  onComplete?: (values: SpendingPolicyFormValues) => void;
}

export function PolicyWizard({ onComplete }: PolicyWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const form = useForm<SpendingPolicyFormValues>({
    resolver: zodResolver(spendingPolicySchema),
    defaultValues: {
      name: 'Agent Guardrail Policy',
      maxSingleTransactionLimit: 1000,
      rollingBudgetLimit: 10000,
      rollingBudgetInterval: 'weekly',
      whitelistAddresses: '',
      allowedAssets: 'XLM, USDC',
    },
    mode: 'onChange',
  });

  const { handleSubmit, trigger, watch } = form;
  const watchedValues = watch();

  const handleNext = async () => {
    const fieldsToValidate = STEP_FIELDS[currentStep] || [];
    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = (data: SpendingPolicyFormValues) => {
    if (onComplete) {
      onComplete(data);
    } else {
      console.log('Policy created:', data);
    }
  };

  const handleApplyTemplate = (template: PolicyTemplate) => {
    form.reset(applyPolicyTemplate(form.getValues(), template));
    setTemplateModalOpen(false);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Spending Policy Rule Builder Wizard
            </CardTitle>
            <CardDescription>
              Configure autonomous agent spending limits, destination whitelists, and asset rules.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setTemplateModalOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Use Template
          </Button>
        </div>
        <StepIndicator steps={WIZARD_STEPS} currentStep={currentStep} />
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {currentStep === 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Step 1: Transaction & Budget Limits</h3>
              <FormField label="Policy Name">
                <Input {...form.register('name')} placeholder="e.g. Treasury Burn Guard" />
                {form.formState.errors.name && (
                  <p className="text-xs text-danger mt-1">{form.formState.errors.name.message}</p>
                )}
              </FormField>

              <FormField label="Max Single Transaction Limit">
                <Input type="number" {...form.register('maxSingleTransactionLimit')} placeholder="2000" />
                {form.formState.errors.maxSingleTransactionLimit && (
                  <p className="text-xs text-danger mt-1">
                    {form.formState.errors.maxSingleTransactionLimit.message}
                  </p>
                )}
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Rolling Budget Limit">
                  <Input type="number" {...form.register('rollingBudgetLimit')} placeholder="20000" />
                  {form.formState.errors.rollingBudgetLimit && (
                    <p className="text-xs text-danger mt-1">
                      {form.formState.errors.rollingBudgetLimit.message}
                    </p>
                  )}
                </FormField>

                <FormField label="Budget Interval">
                  <Select {...form.register('rollingBudgetInterval')}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </Select>
                </FormField>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Step 2: Destination Whitelist</h3>
              <FormField label="Allowed Recipient Addresses (comma-separated Stellar public keys)">
                <p className="text-xs text-foreground-secondary mb-1.5">Leave blank to allow any recipient, or specify authorized G... addresses.</p>
                <Input
                  {...form.register('whitelistAddresses')}
                  placeholder="GCGN7K2J2L5V4D7C7..."
                />
                {form.formState.errors.whitelistAddresses && (
                  <p className="text-xs text-danger mt-1">
                    {form.formState.errors.whitelistAddresses.message}
                  </p>
                )}
              </FormField>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Step 3: Allowed Assets</h3>
              <FormField label="Allowed Asset Codes (comma-separated)">
                <p className="text-xs text-foreground-secondary mb-1.5">e.g. XLM, USDC, EURC</p>
                <Input {...form.register('allowedAssets')} placeholder="XLM, USDC" />
                {form.formState.errors.allowedAssets && (
                  <p className="text-xs text-danger mt-1">
                    {form.formState.errors.allowedAssets.message}
                  </p>
                )}
              </FormField>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Step 4: Review Policy Configuration</h3>
              <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Policy Name:</span>
                  <span className="font-medium text-foreground">{watchedValues.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Max Single Transaction:</span>
                  <span className="font-medium text-foreground">{watchedValues.maxSingleTransactionLimit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Rolling Budget:</span>
                  <span className="font-medium text-foreground">
                    {watchedValues.rollingBudgetLimit} ({watchedValues.rollingBudgetInterval})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Whitelist Addresses:</span>
                  <span className="font-medium text-foreground max-w-[240px] truncate">
                    {watchedValues.whitelistAddresses || 'None (Any)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-secondary">Allowed Assets:</span>
                  <span className="font-medium text-foreground">{watchedValues.allowedAssets}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>

            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext} className="gap-2">
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Create Policy
              </Button>
            )}
          </div>
        </form>
      </CardContent>

      <PolicyTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onApply={handleApplyTemplate}
      />
    </Card>
  );
}

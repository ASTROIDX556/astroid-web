'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StepIndicatorProps {
  steps: readonly { key: string; label: string }[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Wizard steps" className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-initial">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                disabled={index > currentStep}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'border-2 border-primary bg-background text-primary',
                  !isCompleted && !isCurrent && 'border border-border text-foreground-secondary',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </button>
              <div className="hidden sm:block">
                <p className={cn('text-xs font-medium', isCurrent ? 'text-foreground' : 'text-foreground-secondary')}>
                  Step {index + 1}
                </p>
                <p className={cn('text-sm font-semibold', isCurrent ? 'text-foreground' : 'text-foreground-secondary')}>
                  {step.label}
                </p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="mx-4 flex-1 h-[2px] bg-border hidden sm:block" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

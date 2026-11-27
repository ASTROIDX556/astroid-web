'use client';

import React, { useEffect, useId, useReducer, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField, Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import {
  POLICY_SIMULATION_STEPS,
  describePolicySimulationAnnouncement,
  evaluatePolicySimulation,
  focusTargetForTransition,
  initialPolicySimulationFlowState,
  policySimulationFlowReducer,
  type PolicySimulationStep,
} from './policySimulationFlow';
import {
  policySimulationInputSchema,
  type PolicySimulationInputValues,
} from './spendingPolicySchema';
import type { PolicySimulationModalResult } from './types';

interface PolicySimulationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSimulationComplete?: (result: PolicySimulationModalResult) => void;
}

const SIMULATION_LATENCY_MS = 800;

const defaultValues: PolicySimulationInputValues = {
  amount: 100,
  recipientAddress: 'GBC2XZ743X7Z5X423Z5X423Z5X423Z5X423Z5X423Z5X423Z5X423Z5X',
  assetType: 'USDC',
  agentId: 'agent-treasury-01',
};

/**
 * Multi-step spending-rule simulation modal (#182, accessibility #525).
 *
 * Built on the shared `Dialog` primitive, which provides `role="dialog"`,
 * `aria-modal`, `aria-labelledby`/`aria-describedby`, the focus trap
 * (Tab/Shift+Tab wrap inside the panel), Escape and overlay dismissal, and
 * focus restoration to the trigger on close.
 *
 * Keyboard flow:
 * - Opening focuses the Amount field (step 1, "Transaction parameters").
 * - Enter in any field, or Enter/Space on "Run simulation", submits. Invalid
 *   fields are marked `aria-invalid`, described by their error message, and
 *   the first one receives focus.
 * - A valid submit moves to step 2, "Simulation results", and focuses its
 *   heading so focus never stays on the removed form.
 * - "Edit parameters" returns to step 1 and focuses the Amount field.
 * - Escape, the header close button or "Close" dismiss from either step.
 *
 * Screen-reader announcements come from two persistent, visually hidden live
 * regions: progress and passes are `polite` (`role="status"`); blocked
 * results and errors are `assertive` (`role="alert"`). Each region is emptied
 * whenever its message no longer applies, so a repeat result is announced
 * again and returning to step 1 never re-reads an old one.
 */
export function PolicySimulationModal({
  isOpen = true,
  onClose,
  onSimulationComplete,
}: PolicySimulationModalProps) {
  const [state, dispatch] = useReducer(policySimulationFlowReducer, initialPolicySimulationFlowState);
  const stepIndicatorId = useId();
  const resultsHeadingId = useId();
  const amountRef = useRef<HTMLInputElement | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<PolicySimulationStep>(state.step);
  const onCompleteRef = useRef(onSimulationComplete);
  onCompleteRef.current = onSimulationComplete;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PolicySimulationInputValues>({
    resolver: zodResolver(policySimulationInputSchema),
    defaultValues,
  });

  // Every opening starts at step 1 with a clean slate; this also abandons a
  // run that was still in flight when the modal was dismissed.
  useEffect(() => {
    if (isOpen) {
      dispatch({ type: 'reset' });
      reset(defaultValues);
    }
  }, [isOpen, reset]);

  // Run the simulation for the current runId. A run that is abandoned (edit,
  // close, reopen) is ignored by the reducer when it settles.
  const pendingValuesRef = useRef<PolicySimulationInputValues | null>(null);
  useEffect(() => {
    if (state.phase !== 'running' || !pendingValuesRef.current) return undefined;
    const runId = state.runId;
    const values = pendingValuesRef.current;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const result = evaluatePolicySimulation(values);
        dispatch({ type: 'resolve', runId, result });
        onCompleteRef.current?.(result);
      } catch (error) {
        dispatch({
          type: 'reject',
          runId,
          message:
            error instanceof Error && error.message
              ? error.message
              : 'An unexpected error occurred during simulation.',
        });
      }
    }, SIMULATION_LATENCY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [state.phase, state.runId]);

  // Keep focus on something that still exists after a step transition.
  useEffect(() => {
    const target = focusTargetForTransition(previousStepRef.current, state.step);
    previousStepRef.current = state.step;
    if (!isOpen || !target) return;
    if (target === 'results-heading') resultsHeadingRef.current?.focus();
    else amountRef.current?.focus();
  }, [isOpen, state.step]);

  const onSubmit = (values: PolicySimulationInputValues) => {
    pendingValuesRef.current = values;
    dispatch({ type: 'start' });
  };

  const handleClose = () => {
    dispatch({ type: 'reset' });
    onClose?.();
  };

  const announcement = describePolicySimulationAnnouncement(state);
  const currentStepIndex = POLICY_SIMULATION_STEPS.findIndex((step) => step.id === state.step);
  const amountField = register('amount');
  const { result } = state;

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      size="lg"
      title="Spending rule simulation"
      description="Test proposed transaction parameters against active spending policies before deploying."
      initialFocusRef={amountRef}
      className="max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-5">
        <ol
          id={stepIndicatorId}
          aria-label="Simulation steps"
          className="grid grid-cols-2 gap-2 text-2xs font-medium"
        >
          {POLICY_SIMULATION_STEPS.map((step, index) => {
            const current = index === currentStepIndex;
            const complete = index < currentStepIndex;
            return (
              <li
                key={step.id}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-sm border px-3 py-2',
                  current
                    ? 'border-border-strong bg-surface-secondary text-foreground'
                    : 'border-border text-foreground-secondary',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-2xs',
                    current || complete
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border-strong',
                  )}
                >
                  {index + 1}
                </span>
                <span>
                  <span className="sr-only">
                    Step {index + 1} of {POLICY_SIMULATION_STEPS.length}:{' '}
                  </span>
                  {step.label}
                  {complete && <span className="sr-only"> (completed)</span>}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Persistent live regions: mounted with the dialog, filled on change. */}
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement?.politeness === 'polite' ? announcement.message : ''}
        </p>
        <p role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
          {announcement?.politeness === 'assertive' ? announcement.message : ''}
        </p>

        {state.step === 'parameters' ? (
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            aria-label="Transaction parameters"
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Amount"
                htmlFor="policy-simulation-amount"
                required
                error={errors.amount?.message}
              >
                <Input
                  id="policy-simulation-amount"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  invalid={Boolean(errors.amount)}
                  {...amountField}
                  ref={(element) => {
                    amountField.ref(element);
                    amountRef.current = element;
                  }}
                />
              </FormField>

              <FormField
                label="Asset type"
                htmlFor="policy-simulation-asset"
                required
                error={errors.assetType?.message}
              >
                <Input
                  id="policy-simulation-asset"
                  type="text"
                  autoComplete="off"
                  invalid={Boolean(errors.assetType)}
                  {...register('assetType')}
                />
              </FormField>
            </div>

            <FormField
              label="Recipient address"
              htmlFor="policy-simulation-recipient"
              required
              hint="Stellar public key starting with G (56 characters)."
              error={errors.recipientAddress?.message}
            >
              <Input
                id="policy-simulation-recipient"
                type="text"
                autoComplete="off"
                spellCheck={false}
                invalid={Boolean(errors.recipientAddress)}
                {...register('recipientAddress')}
              />
            </FormField>

            <FormField
              label="Agent ID"
              htmlFor="policy-simulation-agent"
              required
              error={errors.agentId?.message}
            >
              <Input
                id="policy-simulation-agent"
                type="text"
                autoComplete="off"
                invalid={Boolean(errors.agentId)}
                {...register('agentId')}
              />
            </FormField>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => reset(defaultValues)}>
                Reset fields
              </Button>
              <Button type="submit" leftIcon={<Play className="h-4 w-4" aria-hidden />}>
                Run simulation
              </Button>
            </div>
          </form>
        ) : (
          <section
            aria-labelledby={resultsHeadingId}
            aria-busy={state.phase === 'running'}
            className="space-y-4"
          >
            <h3
              id={resultsHeadingId}
              ref={resultsHeadingRef}
              tabIndex={-1}
              className="font-display text-base font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Simulation results
            </h3>

            {state.phase === 'running' && (
              <div className="flex items-center gap-2 rounded-card border border-border bg-surface-secondary/40 p-4 text-sm text-foreground-secondary">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Evaluating policy rules…
              </div>
            )}

            {state.phase === 'error' && (
              <div className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger-soft/30 p-4 text-sm">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
                <div>
                  <p className="font-semibold text-foreground">Simulation could not be completed</p>
                  <p className="mt-1 text-xs text-foreground-secondary">{state.error}</p>
                </div>
              </div>
            )}

            {result && (state.phase === 'passed' || state.phase === 'blocked') && (
              <div className="space-y-4 rounded-card border border-border bg-surface-secondary/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                    ) : (
                      <XCircle className="h-5 w-5 text-warning" aria-hidden />
                    )}
                    <p className="text-sm font-semibold text-foreground">{result.summary}</p>
                  </div>
                  <Badge variant={result.success ? 'success' : 'warning'}>
                    {result.success ? 'PASS' : 'BLOCK'}
                  </Badge>
                </div>

                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                    Evaluation logs
                  </h4>
                  <ul className="space-y-2">
                    {result.logs.map((log) => (
                      <li
                        key={log.ruleId}
                        className="flex items-start justify-between gap-3 rounded-sm border border-border bg-surface p-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{log.ruleName}</span>
                            <Badge
                              variant={log.status === 'pass' ? 'success' : 'warning'}
                              size="sm"
                            >
                              {log.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-foreground-secondary">{log.message}</p>
                        </div>
                        <time
                          dateTime={log.timestamp}
                          className="whitespace-nowrap text-2xs text-foreground-muted"
                        >
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </time>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => dispatch({ type: 'edit' })}
                leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
              >
                Edit parameters
              </Button>
              <Button type="button" variant="secondary" onClick={handleClose}>
                Close simulation
              </Button>
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}

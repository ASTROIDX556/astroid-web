'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import {
  getFocusIndexAfterRemoval,
  getNextSliderValue,
  isActivationKey,
  type SliderBounds,
} from './policyRuleKeyboard';
import {
  defaultRule,
  ruleActionOptions,
  ruleFieldOptions,
  ruleOperatorOptions,
  simulatePolicyRules,
  type PolicyRule,
  validateRule,
} from './rulesSchema';

/** A configured rule with a stable id (for keys and focus targets) and enabled state. */
type ConfiguredRule = PolicyRule & { id: string; enabled: boolean };

const SIMULATION_BOUNDS: SliderBounds = { min: 0, max: 10000, step: 1, largeStep: 100 };

/** Token-based focus indicator shared by every interactive control in the builder. */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const fieldClass = cn(
  'w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-gold',
  focusRing,
);

const humanize = (value: string) => value.replace(/_/g, ' ');

const describeRule = (rule: PolicyRule) =>
  `If ${rule.field} ${humanize(rule.operator)} ${rule.value} Then ${humanize(rule.action)}`;

export function PolicyRulesBuilder() {
  const baseId = useId();
  const ids = {
    field: `${baseId}-field`,
    operator: `${baseId}-operator`,
    value: `${baseId}-value`,
    valueHint: `${baseId}-value-hint`,
    action: `${baseId}-action`,
    error: `${baseId}-error`,
    rulesHeading: `${baseId}-rules-heading`,
    sliderHint: `${baseId}-slider-hint`,
    toggleHint: `${baseId}-toggle-hint`,
  };

  const nextRuleId = useRef(3);
  const [draft, setDraft] = useState<PolicyRule>(defaultRule);
  const [rules, setRules] = useState<ConfiguredRule[]>([
    {
      id: 'rule-1',
      field: 'Transaction Amount',
      operator: 'greater_than',
      value: '2500',
      action: 'require_approval',
      enabled: true,
    },
    {
      id: 'rule-2',
      field: 'Approved Account Whitelist',
      operator: 'in_whitelist',
      value: 'G...A1, G...B2',
      action: 'allow',
      enabled: true,
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [simulationAmount, setSimulationAmount] = useState(500);

  const fieldSelectRef = useRef<HTMLSelectElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const removeButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const activeCount = rules.filter((rule) => rule.enabled).length;

  const handleAddRule = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateRule(draft);
    if (!result.success) {
      setError(
        result.error.issues[0]?.message ?? 'Please fill out the rule before adding it.',
      );
      // Send keyboard users straight to the field that needs fixing.
      valueInputRef.current?.focus();
      return;
    }

    const id = `rule-${nextRuleId.current++}`;
    setRules((current) => [...current, { ...result.data, id, enabled: true }]);
    setDraft(defaultRule);
    setError(null);
    setAnnouncement(`Rule added: ${describeRule(result.data)}`);
    // Return focus to the start of the rule form so the next rule can be entered.
    fieldSelectRef.current?.focus();
  };

  const removeRule = (index: number) => {
    const removed = rules[index];
    if (!removed) return;
    const remaining = rules.filter((_, ruleIndex) => ruleIndex !== index);
    setRules(remaining);
    setAnnouncement(`Rule ${index + 1} removed`);

    // Keep focus inside the list instead of letting it fall back to <body>.
    const focusIndex = getFocusIndexAfterRemoval(index, rules.length);
    const target = focusIndex === null ? undefined : remaining[focusIndex];
    window.requestAnimationFrame(() => {
      const next = target ? removeButtonRefs.current.get(target.id) : undefined;
      (next ?? addButtonRef.current)?.focus();
    });
  };

  const toggleRule = (id: string) => {
    const target = rules.find((rule) => rule.id === id);
    if (!target) return;
    const enabled = !target.enabled;
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)),
    );
    setAnnouncement(`${describeRule(target)} ${enabled ? 'enabled' : 'disabled'}`);
  };

  const handleToggleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    id: string,
  ) => {
    // Native buttons fire click on Enter/Space, but handle them explicitly so the switch
    // behaves consistently (and Space never scrolls the page).
    if (!isActivationKey(event.key)) return;
    event.preventDefault();
    if (!event.repeat) toggleRule(id);
  };

  const handleSliderKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const next = getNextSliderValue(
      event.key,
      event.shiftKey,
      simulationAmount,
      SIMULATION_BOUNDS,
    );
    if (next === null) return;
    event.preventDefault();
    setSimulationAmount(next);
  };

  const simulation = useMemo(
    () =>
      simulatePolicyRules(
        { amount: simulationAmount, asset: 'XLM', destination: 'G...A1' },
        rules,
      ),
    [rules, simulationAmount],
  );

  const evaluationByIndex = useMemo(
    () =>
      new Map(
        simulation.evaluations.map((evaluation) => [evaluation.index, evaluation]),
      ),
    [simulation],
  );

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
              Policy Engine
            </p>
            <CardTitle className="mt-1 text-xl">Visual rule builder</CardTitle>
          </div>
          <Badge variant="outline" size="sm" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {activeCount} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <form
          aria-label="Add policy rule"
          className="space-y-4"
          onSubmit={handleAddRule}
          noValidate
        >
          <div className="grid gap-3 md:grid-cols-[1.25fr_1fr_1.25fr_1fr]">
            <div className="space-y-1 text-xs text-foreground-secondary">
              <label htmlFor={ids.field}>Field</label>
              <select
                id={ids.field}
                ref={fieldSelectRef}
                value={draft.field}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    field: event.target.value as PolicyRule['field'],
                  }))
                }
                className={fieldClass}
              >
                {ruleFieldOptions.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 text-xs text-foreground-secondary">
              <label htmlFor={ids.operator}>Operator</label>
              <select
                id={ids.operator}
                value={draft.operator}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    operator: event.target.value as PolicyRule['operator'],
                  }))
                }
                className={fieldClass}
              >
                {ruleOperatorOptions.map((operator) => (
                  <option key={operator} value={operator}>
                    {humanize(operator)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 text-xs text-foreground-secondary">
              <label htmlFor={ids.value}>Value</label>
              <input
                id={ids.value}
                ref={valueInputRef}
                value={draft.value}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, value: event.target.value }))
                }
                aria-required
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${ids.valueHint} ${ids.error}` : ids.valueHint}
                className={cn(fieldClass, error && 'border-danger')}
                placeholder="e.g. 5000 or G...A1"
              />
              <p id={ids.valueHint} className="sr-only">
                Amount threshold, asset code, or comma-separated Stellar addresses. Press
                Enter to add the rule.
              </p>
            </div>

            <div className="space-y-1 text-xs text-foreground-secondary">
              <label htmlFor={ids.action}>Action</label>
              <select
                id={ids.action}
                value={draft.action}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    action: event.target.value as PolicyRule['action'],
                  }))
                }
                className={fieldClass}
              >
                {ruleActionOptions.map((action) => (
                  <option key={action} value={action}>
                    {humanize(action)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button
              ref={addButtonRef}
              type="submit"
              variant="gold"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            >
              Add rule
            </Button>
            {error && (
              <p id={ids.error} role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
          </div>
        </form>

        <section aria-labelledby={ids.rulesHeading} className="space-y-3">
          <h3 id={ids.rulesHeading} className="sr-only">
            Configured rules
          </h3>
          <p id={ids.toggleHint} className="sr-only">
            Disabled rules are skipped by the simulator.
          </p>
          {rules.length === 0 ? (
            <p className="text-sm text-foreground-muted">No rules configured yet.</p>
          ) : (
            <ul className="space-y-3">
              {rules.map((rule, index) => {
                const sentence = describeRule(rule);
                const labelId = `${baseId}-${rule.id}-label`;
                return (
                  <li
                    key={rule.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-card border border-border bg-surface-secondary/40 p-3',
                      !rule.enabled && 'opacity-60',
                    )}
                  >
                    <p id={labelId} className="text-sm text-foreground-secondary">
                      <span className="sr-only">Rule {index + 1}: </span>
                      {sentence}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.enabled}
                        aria-labelledby={labelId}
                        aria-describedby={ids.toggleHint}
                        onClick={() => toggleRule(rule.id)}
                        onKeyDown={(event) => handleToggleKeyDown(event, rule.id)}
                        className={cn(
                          'relative inline-flex h-5 w-9 items-center rounded-full border border-border transition-colors',
                          rule.enabled ? 'bg-gold' : 'bg-surface-secondary',
                          focusRing,
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'inline-block h-3.5 w-3.5 rounded-full bg-surface shadow transition-transform',
                            rule.enabled ? 'translate-x-4' : 'translate-x-0.5',
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        ref={(node) => {
                          if (node) removeButtonRefs.current.set(rule.id, node);
                          else removeButtonRefs.current.delete(rule.id);
                        }}
                        onClick={() => removeRule(index)}
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-button border border-border text-foreground-muted transition-colors hover:text-danger',
                          focusRing,
                        )}
                        aria-label={`Remove rule ${index + 1}: ${sentence}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside
          aria-label="Policy simulation"
          className="rounded-card border border-border bg-surface-secondary/40 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Live simulator</h3>
              <p className="text-xs text-foreground-muted">
                Test a transaction amount against the active rules.
              </p>
            </div>
            <output aria-live="polite" className="text-xs text-foreground-secondary">
              {simulationAmount} XLM
            </output>
          </div>
          <label className="mt-3 block text-xs text-foreground-secondary">
            <span>Transaction amount</span>
            <input
              aria-label="Simulated transaction amount"
              aria-valuetext={`${simulationAmount} XLM`}
              aria-describedby={ids.sliderHint}
              type="range"
              min={SIMULATION_BOUNDS.min}
              max={SIMULATION_BOUNDS.max}
              step={SIMULATION_BOUNDS.step}
              value={simulationAmount}
              onChange={(event) => setSimulationAmount(Number(event.target.value))}
              onKeyDown={handleSliderKeyDown}
              className={cn('mt-2 w-full accent-gold', focusRing)}
            />
          </label>
          <p id={ids.sliderHint} className="sr-only">
            Use the arrow keys to adjust by 1 XLM, Shift plus arrow or Page Up and Page
            Down to adjust by 100 XLM, Home and End for the minimum and maximum.
          </p>
          <ul aria-label="Rule evaluation results" className="mt-3 space-y-2">
            {rules.map((rule, index) => {
              if (!rule.enabled) {
                return (
                  <li
                    key={`simulation-${rule.id}`}
                    className="rounded border border-border p-2 text-xs text-foreground-muted"
                  >
                    Skipped (disabled): {rule.field} {humanize(rule.operator)}{' '}
                    {rule.value}
                  </li>
                );
              }
              const evaluation = evaluationByIndex.get(index);
              const matched = evaluation?.matched ?? false;
              return (
                <li
                  key={`simulation-${rule.id}`}
                  className={
                    matched
                      ? 'rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger'
                      : 'rounded border border-success/40 bg-success/10 p-2 text-xs text-success'
                  }
                >
                  {matched ? 'Match' : 'Clear'}: {rule.field} {humanize(rule.operator)}{' '}
                  {rule.value}
                </li>
              );
            })}
          </ul>
          <output
            aria-live="polite"
            className="mt-2 block text-2xs text-foreground-secondary"
          >
            Predicted outcome:{' '}
            <span className="font-medium text-foreground">
              {humanize(simulation.outcome)}
            </span>
            {simulation.invalidRules.length > 0 &&
              ` · ${simulation.invalidRules.length} invalid rule${
                simulation.invalidRules.length === 1 ? '' : 's'
              } skipped`}
          </output>
        </aside>
      </CardContent>
    </Card>
  );
}

export default PolicyRulesBuilder;

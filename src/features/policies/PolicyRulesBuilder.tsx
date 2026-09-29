'use client';

import { useMemo, useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  defaultRule,
  ruleActionOptions,
  ruleFieldOptions,
  ruleOperatorOptions,
  type PolicyRule,
  validateRule,
} from './rulesSchema';

export function PolicyRulesBuilder() {
  const [draft, setDraft] = useState<PolicyRule>(defaultRule);
  const [rules, setRules] = useState<PolicyRule[]>([
    {
      field: 'Transaction Amount',
      operator: 'greater_than',
      value: '2500',
      action: 'require_approval',
    },
    {
      field: 'Approved Account Whitelist',
      operator: 'in_whitelist',
      value: 'G...A1, G...B2',
      action: 'allow',
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [simulationAmount, setSimulationAmount] = useState(500);

  const summary = useMemo(
    () =>
      rules.map(
        (rule) => `If ${rule.field} ${rule.operator.replace(/_/g, ' ')} ${rule.value} Then ${rule.action.replace(/_/g, ' ')}`,
      ),
    [rules],
  );

  const handleAddRule = () => {
    const result = validateRule(draft);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Please fill out the rule before adding it.');
      return;
    }

    setRules((current) => [...current, result.data]);
    setDraft(defaultRule);
    setError(null);
  };

  const removeRule = (index: number) => {
    setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index));
  };

  const simulationResults = useMemo(
    () => rules.map((rule) => {
      if (rule.field !== 'Transaction Amount') return true;
      const threshold = Number(rule.value);
      if (!Number.isFinite(threshold)) return false;
      if (rule.operator === 'greater_than') return simulationAmount > threshold;
      if (rule.operator === 'less_than') return simulationAmount < threshold;
      if (rule.operator === 'equals') return simulationAmount === threshold;
      return true;
    }),
    [rules, simulationAmount],
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
            {rules.length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 md:grid-cols-[1.25fr_1fr_1.25fr_1fr]">
          <label className="space-y-1 text-xs text-foreground-secondary">
            <span>Field</span>
            <select
              value={draft.field}
              onChange={(event) => setDraft((current) => ({ ...current, field: event.target.value as PolicyRule['field'] }))}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
            >
              {ruleFieldOptions.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-foreground-secondary">
            <span>Operator</span>
            <select
              value={draft.operator}
              onChange={(event) => setDraft((current) => ({ ...current, operator: event.target.value as PolicyRule['operator'] }))}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
            >
              {ruleOperatorOptions.map((operator) => (
                <option key={operator} value={operator}>
                  {operator.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-foreground-secondary">
            <span>Value</span>
            <input
              value={draft.value}
              onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              placeholder="e.g. 5000 or G...A1"
            />
          </label>

          <label className="space-y-1 text-xs text-foreground-secondary">
            <span>Action</span>
            <select
              value={draft.action}
              onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value as PolicyRule['action'] }))}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
            >
              {ruleActionOptions.map((action) => (
                <option key={action} value={action}>
                  {action.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="gold" size="sm" leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={handleAddRule}>
            Add rule
          </Button>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <div className="space-y-3">
          {summary.map((sentence, index) => (
            <div key={`${sentence}-${index}`} className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-secondary/40 p-3">
              <p className="text-sm text-foreground-secondary">{sentence}</p>
              <button
                type="button"
                onClick={() => removeRule(index)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-button border border-border text-foreground-muted transition-colors hover:text-danger"
                aria-label={`Remove rule ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>

        <aside aria-label="Policy simulation" className="rounded-card border border-border bg-surface-secondary/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Live simulator</h3>
              <p className="text-xs text-foreground-muted">Test a transaction amount against the active rules.</p>
            </div>
            <output aria-live="polite" className="text-xs text-foreground-secondary">{simulationAmount} XLM</output>
          </div>
          <label className="mt-3 block text-xs text-foreground-secondary">
            <span>Transaction amount</span>
            <input
              aria-label="Simulated transaction amount"
              type="range"
              min="0"
              max="10000"
              step="1"
              value={simulationAmount}
              onChange={(event) => setSimulationAmount(Number(event.target.value))}
              className="mt-2 w-full accent-gold focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </label>
          <div className="mt-3 space-y-2">
            {rules.map((rule, index) => (
              <div key={`simulation-${index}`} className={simulationResults[index] ? 'rounded border border-success/40 bg-success/10 p-2 text-xs text-success' : 'rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger'}>
                {simulationResults[index] ? 'Pass' : 'Fail'}: {rule.field} {rule.operator.replace(/_/g, ' ')} {rule.value}
              </div>
            ))}
          </div>
        </aside>
      </CardContent>
    </Card>
  );
}

export default PolicyRulesBuilder;

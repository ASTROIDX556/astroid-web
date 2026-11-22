'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, FlaskConical, ShieldAlert, XCircle } from 'lucide-react';
import type { Policy } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  configFromPolicies,
  evaluateProposedTransaction,
  proposedTransactionSchema,
  type PolicyEvaluationResponse,
  type PolicySimulationConfig,
} from './policyEvaluation';

export interface PolicySimulationPanelProps {
  policies?: Policy[];
  config?: PolicySimulationConfig;
  className?: string;
}

type Field = 'amount' | 'recipient' | 'department' | 'asset';
type FormState = Record<Field, string>;

const initialForm: FormState = {
  amount: '250',
  recipient: '',
  department: 'Operations',
  asset: 'USDC',
};

/** Manual policy preview; never sends, signs, or broadcasts a transaction. */
export function PolicySimulationPanel({ policies = [], config, className = '' }: PolicySimulationPanelProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [result, setResult] = useState<PolicyEvaluationResponse | null>(null);
  const reduceMotion = useReducedMotion();

  const rules = useMemo(() => config ?? configFromPolicies(policies), [config, policies]);
  const update = (field: Field, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setResult(null);
  };

  const simulate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = proposedTransactionSchema.safeParse({
      amount: form.amount.trim() === '' ? NaN : Number(form.amount),
      recipient: form.recipient,
      department: form.department,
      asset: form.asset,
    });
    if (!parsed.success) {
      const nextErrors: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      setResult(null);
      return;
    }
    setErrors({});
    setResult(evaluateProposedTransaction(parsed.data, rules));
  };

  const fields: { id: Field; label: string; help: string }[] = [
    { id: 'amount', label: 'Amount', help: 'Transaction amount in the selected asset' },
    { id: 'recipient', label: 'Recipient Stellar address', help: 'Enter the destination G-address' },
    { id: 'department', label: 'Department', help: 'Department the proposed spend belongs to' },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-gold" aria-hidden />
          Proposed transaction simulator
        </CardTitle>
        <p className="text-xs text-foreground-secondary">Check a hypothetical agent transaction against configured spending rules. No transaction is submitted.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={simulate} noValidate className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id} className={field.id === 'recipient' ? 'sm:col-span-2' : ''}>
              <label className="mb-1 block text-xs font-semibold" htmlFor={`preview-${field.id}`}>{field.label}</label>
              <input
                id={`preview-${field.id}`}
                name={field.id}
                type={field.id === 'amount' ? 'number' : 'text'}
                min={field.id === 'amount' ? '0.0000001' : undefined}
                step={field.id === 'amount' ? 'any' : undefined}
                value={form[field.id]}
                onChange={(event) => update(field.id, event.target.value)}
                aria-invalid={Boolean(errors[field.id])}
                aria-describedby={errors[field.id] ? `preview-${field.id}-error` : `preview-${field.id}-help`}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-ring"
                placeholder={field.id === 'recipient' ? 'G...' : undefined}
              />
              <p id={`preview-${field.id}-help`} className="mt-1 text-xs text-foreground-muted">{field.help}</p>
              {errors[field.id] && <p id={`preview-${field.id}-error`} role="alert" className="mt-1 text-xs text-danger">{errors[field.id]}</p>}
            </div>
          ))}
          <div>
            <label htmlFor="preview-asset" className="mb-1 block text-xs font-semibold">Asset</label>
            <select id="preview-asset" value={form.asset} onChange={(event) => update('asset', event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-ring">
              <option value="USDC">USDC</option>
              <option value="XLM">XLM</option>
              <option value="EURC">EURC</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="gold">Simulate transaction</Button>
            <Button type="button" variant="secondary" onClick={() => { setForm(initialForm); setErrors({}); setResult(null); }}>Reset</Button>
          </div>
        </form>

        <div className="mt-5" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.section key={result.evaluatedAt} initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}
                aria-label="Simulation result">
                <div className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 ${result.passed ? 'border-success/30 bg-success-soft' : 'border-danger/30 bg-danger-soft'}`}>
                  <div className="flex items-center gap-2">
                    {result.passed ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : <ShieldAlert className="h-5 w-5 text-danger" aria-hidden />}
                    <p className="text-sm font-semibold">{result.passed ? 'All configured checks passed' : 'Policy violations detected'}</p>
                  </div>
                  <Badge variant={result.passed ? 'success' : 'danger'}>{result.passed ? 'Pass' : 'Fail'}</Badge>
                </div>
                <ul className="mt-3 space-y-2" aria-label="Evaluated rules">
                  {result.rules.map((rule) => (
                    <li key={rule.id} className="flex items-start gap-3 rounded-md border border-border bg-surface p-3">
                      {rule.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Passed" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Failed" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{rule.label}</p>
                        <p className="mt-1 text-xs text-foreground-secondary">{rule.message}</p>
                        {rule.expected && <p className="mt-1 break-all text-xs text-foreground-muted">Limit / policy: {rule.expected} · Proposed: {rule.actual}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-foreground-muted">Simulation only · {new Date(result.evaluatedAt).toLocaleString()}</p>
              </motion.section>
            ) : (
              <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-foreground-muted">
                Enter a transaction and select Simulate transaction to see a rule-by-rule preview.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

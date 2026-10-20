'use client';

import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AlertTriangle, CheckCircle2, FlaskConical, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField, Input, Select } from '@/components/ui/input';
import { isValidStellarPublicKey } from '@/stores/freighter-store';
import type { Policy } from '@/types/domain';

const simulationSchema = z.object({
  recipient: z.string().trim().refine(isValidStellarPublicKey, 'Enter a valid Stellar public key.'),
  asset: z.enum(['XLM', 'USDC']),
  amount: z.coerce.number().positive('Amount must be greater than zero.').finite(),
});

type SimulationValues = z.infer<typeof simulationSchema>;
interface RuleResult {
  id: string;
  name: string;
  passed: boolean;
  explanation: string;
}

function evaluatePolicies(values: SimulationValues, policies: Policy[]): RuleResult[] {
  return policies.filter((policy) => policy.enabled).map((policy) => {
    const configuration = policy.configuration;
    switch (policy.type) {
      case 'max_spend': {
        const limit = Number(configuration.maxAmount ?? configuration.limit);
        const passed = !Number.isFinite(limit) || values.amount <= limit;
        return { id: policy.id, name: policy.name, passed, explanation: passed ? 'Amount is within the configured maximum.' : `Amount exceeds the ${limit.toLocaleString()} limit.` };
      }
      case 'min_spend': {
        const limit = Number(configuration.minAmount);
        const passed = !Number.isFinite(limit) || values.amount >= limit;
        return { id: policy.id, name: policy.name, passed, explanation: passed ? 'Amount meets the configured minimum.' : `Amount is below the ${limit.toLocaleString()} minimum.` };
      }
      case 'daily_budget':
      case 'weekly_budget':
      case 'monthly_budget': {
        const limit = Number(configuration.limit);
        const passed = !Number.isFinite(limit) || values.amount <= limit;
        return { id: policy.id, name: policy.name, passed, explanation: passed ? 'Transaction fits within the configured budget limit.' : `Amount exceeds the ${limit.toLocaleString()} budget limit.` };
      }
      case 'allowed_assets': {
        const assets = Array.isArray(configuration.assets) ? configuration.assets.map(String) : [];
        const passed = assets.length === 0 || assets.includes(values.asset);
        return { id: policy.id, name: policy.name, passed, explanation: passed ? `${values.asset} is allowed.` : `${values.asset} is not in the allowed asset list.` };
      }
      case 'allowed_recipients': {
        const recipients = Array.isArray(configuration.recipients) ? configuration.recipients.map(String) : [];
        const passed = recipients.length === 0 || recipients.includes(values.recipient);
        return { id: policy.id, name: policy.name, passed, explanation: passed ? 'Recipient is allowed.' : 'Recipient is not on the allow-list.' };
      }
      case 'blocked_recipients': {
        const recipients = Array.isArray(configuration.recipients) ? configuration.recipients.map(String) : [];
        const passed = !recipients.includes(values.recipient);
        return { id: policy.id, name: policy.name, passed, explanation: passed ? 'Recipient is not blocked.' : 'Recipient is on the block-list.' };
      }
      case 'emergency_lock': {
        const passed = configuration.active !== true;
        return { id: policy.id, name: policy.name, passed, explanation: passed ? 'Emergency lock is inactive.' : 'Emergency lock blocks all transactions.' };
      }
      default:
        return { id: policy.id, name: policy.name, passed: true, explanation: 'Rule requires runtime context and did not block this simulation.' };
    }
  });
}

export interface PolicySimulationModalProps {
  policies: Policy[];
}

export function PolicySimulationModal({ policies }: PolicySimulationModalProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<RuleResult[] | null>(null);
  const form = useForm<SimulationValues>({
    resolver: zodResolver(simulationSchema),
    mode: 'onSubmit',
    defaultValues: {
      recipient: 'GCFQ4I7ZTW5W3K7CSW2USSQK6AZW5KTQH7QA2S5JS5EIUJF2EZRD3E6E',
      asset: 'USDC',
      amount: 1250,
    },
  });
  const errors = form.formState.errors;
  const hasRules = Boolean(results && results.length > 0);
  const passed = hasRules && Boolean(results?.every((result) => result.passed));

  const close = () => {
    setOpen(false);
    setResults(null);
  };

  const simulate = form.handleSubmit((values) => {
    setResults(evaluatePolicies(values, policies));
  });

  return (
    <>
      <Button type="button" variant="gold" leftIcon={<FlaskConical className="h-4 w-4" aria-hidden />} onClick={() => setOpen(true)}>
        Simulate transaction
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Policy simulation"
        description="Test a Stellar transaction against every active policy."
        size="lg"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={close}>Close</Button>
            <Button type="submit" form="policy-simulation-form" variant="gold">Evaluate</Button>
          </>
        )}
      >
        <form id="policy-simulation-form" onSubmit={simulate} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Recipient address" htmlFor="simulation-recipient" required error={errors.recipient?.message}>
              <Input id="simulation-recipient" {...form.register('recipient')} invalid={Boolean(errors.recipient)} />
            </FormField>
            <FormField label="Asset" htmlFor="simulation-asset" required error={errors.asset?.message}>
              <Select id="simulation-asset" {...form.register('asset')} invalid={Boolean(errors.asset)}>
                <option value="XLM">XLM</option>
                <option value="USDC">USDC</option>
              </Select>
            </FormField>
            <FormField label="Amount" htmlFor="simulation-amount" required error={errors.amount?.message}>
              <Input id="simulation-amount" type="number" min="0.0000001" step="any" {...form.register('amount', { valueAsNumber: true })} invalid={Boolean(errors.amount)} />
            </FormField>
          </div>

          {results && (
            <section aria-live="polite" aria-label="Simulation results" className="space-y-3 border-t border-border pt-4">
              <div className={`flex items-center gap-3 rounded-sm border p-3 ${results.length === 0 ? 'border-gold/30 bg-gold-soft/40' : passed ? 'border-success/30 bg-success-soft/40' : 'border-danger/30 bg-danger-soft/40'}`} role="status">
                {passed ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : results.length === 0 ? <FlaskConical className="h-5 w-5 text-gold" aria-hidden /> : <AlertTriangle className="h-5 w-5 text-danger" aria-hidden />}
                <p className="flex-1 text-sm font-semibold text-foreground">{results.length === 0 ? 'No active policies to evaluate' : passed ? 'Transaction passes policy checks' : 'Transaction blocked by policy'}</p>
                <Badge variant={results.length === 0 ? 'neutral' : passed ? 'success' : 'danger'}>{results.length === 0 ? 'No rules' : `${results.filter((result) => result.passed).length}/${results.length} passed`}</Badge>
              </div>
              {results.map((result) => (
                <div key={result.id} className="flex items-start gap-3 border-b border-border py-2 last:border-0">
                  {result.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 text-danger" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{result.name} <span className="font-mono text-2xs text-foreground-muted">{result.id}</span></p>
                    <p className="mt-0.5 text-2xs text-foreground-secondary">{result.explanation}</p>
                  </div>
                  <Badge variant={result.passed ? 'success' : 'danger'} size="sm">{result.passed ? 'Pass' : 'Fail'}</Badge>
                </div>
              ))}
            </section>
          )}
        </form>
      </Dialog>
    </>
  );
}
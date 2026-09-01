'use client';

import { useMemo, useState } from 'react';
import { Check, Info, ShieldAlert, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { defaultPolicyRules, evaluatePolicyRules, type PolicyRule } from './rulesSchema';

const defaultTransaction = {
  amount: '3200',
  assetCode: 'USDC',
  destinationAddress: 'G...A1',
  agentId: 'agent-77',
};

export function PolicySimulationSandbox() {
  const [transaction, setTransaction] = useState(defaultTransaction);

  const result = useMemo(() => {
    return evaluatePolicyRules(defaultPolicyRules, transaction);
  }, [transaction]);

  const handleFieldChange = (field: keyof typeof defaultTransaction, value: string) => {
    setTransaction((current) => ({ ...current, [field]: value }));
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">
              Rule tester
            </p>
            <CardTitle className="mt-1 text-xl">Simulation sandbox</CardTitle>
          </div>
          <Badge variant={result.passed ? 'success' : 'danger'} size="sm" dot>
            {result.passed ? 'Pass' : 'Fail'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-foreground-secondary">
            <span>Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={transaction.amount}
              onChange={(event) => handleFieldChange('amount', event.target.value)}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              aria-label="Transaction amount"
            />
          </label>

          <label className="space-y-1 text-xs text-foreground-secondary">
            <span>Asset code</span>
            <input
              value={transaction.assetCode}
              onChange={(event) => handleFieldChange('assetCode', event.target.value)}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              aria-label="Asset code"
            />
          </label>

          <label className="space-y-1 text-xs text-foreground-secondary md:col-span-2">
            <span>Destination address</span>
            <input
              value={transaction.destinationAddress}
              onChange={(event) => handleFieldChange('destinationAddress', event.target.value)}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              aria-label="Destination address"
            />
          </label>

          <label className="space-y-1 text-xs text-foreground-secondary md:col-span-2">
            <span>Agent ID</span>
            <input
              value={transaction.agentId}
              onChange={(event) => handleFieldChange('agentId', event.target.value)}
              className="w-full rounded-button border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
              aria-label="Agent ID"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => setTransaction(defaultTransaction)}>
            Reset sample
          </Button>
          <span className="text-xs text-foreground-secondary">
            Evaluating {defaultPolicyRules.length} active rules against this payload.
          </span>
        </div>

        <div className="space-y-3 rounded-card border border-border bg-surface-secondary/40 p-4">
          <div className="flex items-center gap-2">
            {result.passed ? (
              <Check className="h-4 w-4 text-success" aria-hidden />
            ) : (
              <ShieldAlert className="h-4 w-4 text-danger" aria-hidden />
            )}
            <p className="text-sm font-medium text-foreground">
              {result.passed ? 'Transaction passes all configured rules.' : 'Transaction violates one or more rules.'}
            </p>
          </div>

          {result.failingRules.length > 0 ? (
            <ul className="space-y-2">
              {result.failingRules.map(({ rule, evaluation }, index) => (
                <li key={`${rule.field}-${index}`} className="rounded-md border border-danger/30 bg-danger-soft/20 p-3 text-xs text-foreground-secondary">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{rule.field}</span>
                    <Badge variant="danger" size="sm">
                      {rule.action.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-danger">{evaluation.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success-soft/20 p-3 text-xs text-success">
              <Info className="h-4 w-4" aria-hidden />
              No rule violations for this payload.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-2xs font-medium uppercase tracking-[0.2em] text-foreground-muted">
            Rule result JSON
          </p>
          <pre className="overflow-x-auto rounded-card border border-border bg-surface p-3 text-xs text-foreground-secondary">
            {JSON.stringify(
              {
                request: transaction,
                passed: result.passed,
                failingRules: result.failingRules.map(({ rule, evaluation }) => ({
                  field: rule.field,
                  operator: rule.operator,
                  action: rule.action,
                  reason: evaluation.reason,
                })),
              },
              null,
              2,
            )}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

export default PolicySimulationSandbox;

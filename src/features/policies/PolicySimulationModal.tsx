'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  policySimulationInputSchema,
  type PolicySimulationInputValues,
} from './spendingPolicySchema';
import type { PolicySimulationModalResult, PolicyRuleEvaluationLog } from './types';

interface PolicySimulationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSimulationComplete?: (result: PolicySimulationModalResult) => void;
}

export function PolicySimulationModal({
  isOpen = true,
  onClose,
  onSimulationComplete,
}: PolicySimulationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PolicySimulationModalResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PolicySimulationInputValues>({
    resolver: zodResolver(policySimulationInputSchema),
    defaultValues: {
      amount: 100,
      recipientAddress: 'GBC2XZ743X7Z5X423Z5X423Z5X423Z5X423Z5X423Z5X423Z5X423Z5X',
      assetType: 'USDC',
      agentId: 'agent-treasury-01',
    },
  });

  const onSubmit = async (data: PolicySimulationInputValues) => {
    setIsLoading(true);
    setResult(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const amount = data.amount;
      const isBlock = amount > 5000;

      const logs: PolicyRuleEvaluationLog[] = [
        {
          ruleId: 'rule-01',
          ruleName: 'Agent Identity Authorization',
          status: 'pass',
          message: `Agent ID "${data.agentId}" is verified and authorized to initiate transactions.`,
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-02',
          ruleName: 'Asset Whitelist Check',
          status: 'pass',
          message: `Asset type "${data.assetType}" is included in approved portfolio assets.`,
          timestamp: new Date().toISOString(),
        },
        {
          ruleId: 'rule-03',
          ruleName: 'Single Transaction Spend Ceiling',
          status: amount <= 5000 ? 'pass' : 'block',
          message:
            amount <= 5000
              ? `Transaction amount (${amount} ${data.assetType}) is within the single transaction limit of 5,000.`
              : `Transaction amount (${amount} ${data.assetType}) exceeds single transaction limit of 5,000.`,
          timestamp: new Date().toISOString(),
        },
      ];

      const simResult: PolicySimulationModalResult = {
        success: !isBlock,
        summary: isBlock
          ? 'Simulation FAILED: Transaction violates active spending policies.'
          : 'Simulation PASSED: Transaction complies with all active spending guardrails.',
        logs,
      };

      setResult(simResult);
      onSimulationComplete?.(simResult);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="border-border bg-card shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-gold" />
              Spending Rule Simulation Modal
            </CardTitle>
            <CardDescription>
              Test proposed transaction parameters against active spending policies before deploying.
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground-secondary">Amount</label>
              <Input type="number" step="any" {...register('amount')} />
              {errors.amount && (
                <p className="text-xs text-warning">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground-secondary">Asset Type</label>
              <Input type="text" {...register('assetType')} />
              {errors.assetType && (
                <p className="text-xs text-warning">{errors.assetType.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground-secondary">Recipient Address</label>
            <Input type="text" {...register('recipientAddress')} />
            {errors.recipientAddress && (
              <p className="text-xs text-warning">{errors.recipientAddress.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground-secondary">Agent ID</label>
            <Input type="text" {...register('agentId')} />
            {errors.agentId && (
              <p className="text-xs text-warning">{errors.agentId.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => reset()}>
              Reset
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Simulation
                </>
              )}
            </Button>
          </div>
        </form>

        {result && (
          <div className="space-y-4 rounded-xl border border-border bg-background/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-warning" />
                )}
                <span className="text-sm font-semibold text-foreground">
                  {result.summary}
                </span>
              </div>
              <Badge variant={result.success ? 'success' : 'warning'}>
                {result.success ? 'PASS' : 'BLOCK'}
              </Badge>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                Evaluation Logs
              </p>
              <div className="space-y-2">
                {result.logs.map((log) => (
                  <div
                    key={log.ruleId}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card p-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{log.ruleName}</span>
                        <Badge variant={log.status === 'pass' ? 'success' : 'warning'} size="sm">
                          {log.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-foreground-secondary">{log.message}</p>
                    </div>
                    <span className="text-2xs text-foreground-muted whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

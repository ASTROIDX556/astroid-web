'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  Coins,
  Bot,
  Play,
  Loader2,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { AssetSymbol } from './types';

const policySimulationSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(1000000, 'Amount cannot exceed 1,000,000'),
  asset: z.enum(['XLM', 'USDC', 'BTC', 'ETH', 'EURC'], {
    errorMap: () => ({ message: 'Please select a valid asset' }),
  }),
  targetAgent: z.string().min(1, 'Target agent is required').max(100, 'Agent name too long'),
});

type PolicySimulationFormValues = z.infer<typeof policySimulationSchema>;

interface SimulationResult {
  allowed: boolean;
  violationReason?: string;
  policyViolations: string[];
  estimatedFee: number;
  totalCost: number;
  currentBudgetUsed: number;
  budgetAfterTransaction: number;
  budgetUtilization: number;
}

interface PolicySimulationModalProps {
  open: boolean;
  onClose: () => void;
  currentDailyBudget?: number;
  currentDailySpent?: number;
  maxSingleTransaction?: number;
}

const ASSET_OPTIONS: { value: AssetSymbol; label: string; icon: typeof Coins }[] = [
  { value: 'XLM', label: 'XLM (Stellar)', icon: Coins },
  { value: 'USDC', label: 'USDC (USD Coin)', icon: DollarSign },
  { value: 'BTC', label: 'BTC (Bitcoin)', icon: Coins },
  { value: 'ETH', label: 'ETH (Ethereum)', icon: Coins },
  { value: 'EURC', label: 'EURC (Euro Coin)', icon: DollarSign },
];

const MOCK_AGENTS = [
  'Treasury Manager',
  'Liquidity Provider',
  'Auto-Sweep Bot',
  'Cross-Chain Bridge',
  'Yield Farmer',
  'Arbitrage Agent',
];

export function PolicySimulationModal({
  open,
  onClose,
  currentDailyBudget = 50000,
  currentDailySpent = 12500,
  maxSingleTransaction = 10000,
}: PolicySimulationModalProps) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PolicySimulationFormValues>({
    resolver: zodResolver(policySimulationSchema),
    defaultValues: {
      amount: 1000,
      asset: 'USDC',
      targetAgent: '',
    },
  });

  const runSimulation = async (values: PolicySimulationFormValues) => {
    setIsSimulating(true);
    setSimulationResult(null);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const amountUsd = values.asset === 'XLM' ? values.amount * 0.12 : values.amount;
    const estimatedFee = 0.001; // Minimal Stellar fee
    const totalCost = amountUsd + estimatedFee;
    const budgetAfterTransaction = currentDailySpent + totalCost;
    const budgetUtilization = (budgetAfterTransaction / currentDailyBudget) * 100;

    const violations: string[] = [];
    let allowed = true;
    let violationReason: string | undefined;

    // Check single transaction limit
    if (amountUsd > maxSingleTransaction) {
      violations.push(`Exceeds single transaction limit of ${formatCurrency(maxSingleTransaction, 'USD')}`);
      allowed = false;
      violationReason = 'Transaction amount exceeds policy limit';
    }

    // Check daily budget
    if (budgetAfterTransaction > currentDailyBudget) {
      violations.push(`Would exceed daily budget of ${formatCurrency(currentDailyBudget, 'USD')}`);
      allowed = false;
      violationReason = 'Insufficient daily budget remaining';
    }

    // Check budget utilization threshold (80% warning)
    if (budgetUtilization > 80 && budgetUtilization <= 100) {
      violations.push(`High budget utilization: ${budgetUtilization.toFixed(1)}%`);
    }

    const result: SimulationResult = {
      allowed,
      violationReason,
      policyViolations: violations,
      estimatedFee,
      totalCost,
      currentBudgetUsed: currentDailySpent,
      budgetAfterTransaction,
      budgetUtilization,
    };

    setSimulationResult(result);
    setIsSimulating(false);
  };

  const handleClose = () => {
    reset();
    setSimulationResult(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Policy Simulation"
      description="Test a proposed transaction against active spending policies before execution"
      size="lg"
    >
      <form onSubmit={handleSubmit(runSimulation)} className="space-y-5">
        {/* Transaction Details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Transaction Amount"
            htmlFor="amount"
            error={errors.amount?.message}
            className="gap-2"
          >
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
              <input
                id="amount"
                type="number"
                step="0.01"
                {...register('amount')}
                className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="0.00"
                aria-invalid={!!errors.amount}
              />
            </div>
          </FormField>

          <FormField
            label="Asset Type"
            htmlFor="asset"
            error={errors.asset?.message}
            className="gap-2"
          >
            <select
              id="asset"
              {...register('asset')}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-invalid={!!errors.asset}
            >
              {ASSET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField
          label="Target Agent"
          htmlFor="targetAgent"
          error={errors.targetAgent?.message}
          className="gap-2"
        >
          <div className="relative">
            <Bot className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
            <input
              id="targetAgent"
              list="agent-suggestions"
              {...register('targetAgent')}
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Enter agent name or select from list"
              aria-invalid={!!errors.targetAgent}
            />
            <datalist id="agent-suggestions">
              {MOCK_AGENTS.map((agent) => (
                <option key={agent} value={agent} />
              ))}
            </datalist>
          </div>
        </FormField>

        {/* Current Budget Status */}
        <div className="rounded-md border border-border bg-surface-secondary/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground-secondary">
            Current Budget Status
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className="text-2xs text-foreground-muted">Daily Budget</span>
              <p className="font-mono text-sm font-semibold text-foreground">
                {formatCurrency(currentDailyBudget, 'USD')}
              </p>
            </div>
            <div>
              <span className="text-2xs text-foreground-muted">Already Spent</span>
              <p className="font-mono text-sm font-semibold text-foreground">
                {formatCurrency(currentDailySpent, 'USD')}
              </p>
            </div>
            <div>
              <span className="text-2xs text-foreground-muted">Remaining</span>
              <p className="font-mono text-sm font-semibold text-success">
                {formatCurrency(currentDailyBudget - currentDailySpent, 'USD')}
              </p>
            </div>
          </div>
        </div>

        {/* Simulation Result */}
        <AnimatePresence mode="wait">
          {simulationResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'rounded-md border p-4',
                simulationResult.allowed
                  ? 'border-success/30 bg-success/5'
                  : 'border-destructive/30 bg-destructive/5',
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                {simulationResult.allowed ? (
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" aria-hidden />
                )}
                <span
                  className={cn(
                    'font-semibold text-sm',
                    simulationResult.allowed ? 'text-success' : 'text-destructive',
                  )}
                >
                  {simulationResult.allowed ? 'Transaction Allowed' : 'Transaction Blocked'}
                </span>
                <Badge
                  variant={simulationResult.allowed ? 'success' : 'danger'}
                  size="sm"
                >
                  {simulationResult.allowed ? 'Pass' : 'Fail'}
                </Badge>
              </div>

              {simulationResult.violationReason && (
                <p className="mb-3 text-sm text-foreground">{simulationResult.violationReason}</p>
              )}

              {simulationResult.policyViolations.length > 0 && (
                <div className="mb-3 space-y-2">
                  {simulationResult.policyViolations.map((violation, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-sm border border-border bg-surface-secondary px-3 py-2"
                    >
                      <AlertTriangle
                        className={cn(
                          'mt-0.5 h-4 w-4',
                          simulationResult.allowed ? 'text-warning' : 'text-destructive',
                        )}
                        aria-hidden
                      />
                      <p className="text-xs text-foreground">{violation}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 rounded-sm border border-border bg-surface p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Estimated Fee:</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(simulationResult.estimatedFee, 'USD')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Total Cost:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(simulationResult.totalCost, 'USD')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Budget After Tx:</span>
                  <span className="font-mono text-foreground">
                    {formatCurrency(simulationResult.budgetAfterTransaction, 'USD')}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-foreground-muted">Budget Utilization:</span>
                  <span
                    className={cn(
                      'font-mono font-semibold',
                      simulationResult.budgetUtilization > 80
                        ? 'text-warning'
                        : simulationResult.budgetUtilization > 100
                          ? 'text-destructive'
                          : 'text-success',
                    )}
                  >
                    {simulationResult.budgetUtilization.toFixed(1)}%
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="gold"
            disabled={isSimulating || isSubmitting}
            leftIcon={isSimulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          >
            {isSimulating ? 'Simulating...' : 'Run Simulation'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

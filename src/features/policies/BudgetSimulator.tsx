'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Calculator,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/dashboard/risk-badge';
import { formatCurrency } from '@/lib/format';
import { AssetSymbol, AssetRate, BudgetLimitConfig, SimulationResult } from './types';

const ASSET_RATES: Record<AssetSymbol, AssetRate> = {
  XLM: { symbol: 'XLM', name: 'Stellar Lumens', usdRate: 0.12, decimals: 7 },
  USDC: { symbol: 'USDC', name: 'USD Coin (Stellar)', usdRate: 1.0, decimals: 2 },
  BTC: { symbol: 'BTC', name: 'Bitcoin (Wrapped)', usdRate: 65000.0, decimals: 8 },
  ETH: { symbol: 'ETH', name: 'Ethereum (Wrapped)', usdRate: 3200.0, decimals: 8 },
  EURC: { symbol: 'EURC', name: 'Euro Coin', usdRate: 1.08, decimals: 2 },
};

const DEFAULT_CONFIG: BudgetLimitConfig = {
  dailyLimitUsd: 10000,
  dailySpentUsd: 6800,
  singleTxCeilingUsd: 2500,
  networkBaseFeeXlm: 0.00001,
};

export interface BudgetSimulatorProps {
  config?: Partial<BudgetLimitConfig>;
  className?: string;
}

export function BudgetSimulator({ config = {}, className = '' }: BudgetSimulatorProps) {
  const mergedConfig = useMemo<BudgetLimitConfig>(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  const [assetAmount, setAssetAmount] = useState<string>('1500');
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>('USDC');
  const [customFeeXlm, setCustomFeeXlm] = useState<string>('0.00001');

  const simulation = useMemo<SimulationResult>(() => {
    const rawAmount = parseFloat(assetAmount);
    const validAmount = isNaN(rawAmount) || rawAmount < 0 ? 0 : rawAmount;
    const rate = ASSET_RATES[selectedAsset] || ASSET_RATES.USDC;

    const amountUsd = validAmount * rate.usdRate;
    const feeXlm = parseFloat(customFeeXlm) || mergedConfig.networkBaseFeeXlm;
    const networkFeeUsd = feeXlm * ASSET_RATES.XLM.usdRate;
    const totalCostUsd = amountUsd + networkFeeUsd;

    const currentSpentUsd = mergedConfig.dailySpentUsd;
    const updatedSpentUsd = currentSpentUsd + totalCostUsd;
    const dailyLimitUsd = mergedConfig.dailyLimitUsd > 0 ? mergedConfig.dailyLimitUsd : 1;

    const currentUtilizationPct = Math.min(100, (currentSpentUsd / dailyLimitUsd) * 100);
    const updatedUtilizationPct = Math.min(100, (updatedSpentUsd / dailyLimitUsd) * 100);

    const exceedsSingleTxCeiling =
      mergedConfig.singleTxCeilingUsd > 0 && amountUsd > mergedConfig.singleTxCeilingUsd;
    const exceedsDailyLimit = updatedSpentUsd > dailyLimitUsd;

    const warnings: string[] = [];
    if (exceedsSingleTxCeiling) {
      warnings.push(
        `Transaction value (${formatCurrency(amountUsd, 'USD')}) exceeds single transaction ceiling of ${formatCurrency(mergedConfig.singleTxCeilingUsd, 'USD')}.`
      );
    }
    if (exceedsDailyLimit) {
      const over = updatedSpentUsd - dailyLimitUsd;
      warnings.push(
        `Simulation breaches daily organization cap by ${formatCurrency(over, 'USD')}.`
      );
    }
    if (updatedUtilizationPct >= 80 && !exceedsDailyLimit) {
      warnings.push(
        `Simulated budget utilization will reach ${Math.round(updatedUtilizationPct)}% of daily envelope.`
      );
    }

    return {
      assetAmount: validAmount,
      assetSymbol: selectedAsset,
      amountUsd,
      networkFeeXlm: feeXlm,
      networkFeeUsd,
      totalCostUsd,
      currentSpentUsd,
      updatedSpentUsd,
      dailyLimitUsd,
      currentUtilizationPct,
      updatedUtilizationPct,
      exceedsSingleTxCeiling,
      exceedsDailyLimit,
      isPolicyViolation: exceedsSingleTxCeiling || exceedsDailyLimit,
      warnings,
    };
  }, [assetAmount, selectedAsset, customFeeXlm, mergedConfig]);

  const handleReset = useCallback(() => {
    setAssetAmount('1500');
    setSelectedAsset('USDC');
    setCustomFeeXlm('0.00001');
  }, []);

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="border-b border-border bg-surface-primary/60 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-gold" aria-hidden="true" />
              <CardTitle className="text-base font-semibold">
                Client-Side Transaction Budget Simulator
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Simulate proposed transaction impact against organizational spend limits before requesting signers.
            </CardDescription>
          </div>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            aria-label="Reset simulation inputs"
          >
            <RotateCcw className="h-3.5 w-3.5 text-foreground-secondary" aria-hidden="true" />
            <span>Reset Simulator</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label
              htmlFor="sim-asset-amount"
              className="text-xs font-medium text-foreground-secondary flex items-center justify-between"
            >
              <span>Proposed Amount</span>
              <span className="text-2xs text-foreground-muted">Asset Value</span>
            </label>
            <input
              id="sim-asset-amount"
              type="number"
              min="0"
              step="any"
              value={assetAmount}
              onChange={(e) => setAssetAmount(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full rounded-md border border-border bg-surface-primary px-3 py-2 text-xs font-mono text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sim-asset-symbol" className="text-xs font-medium text-foreground-secondary">
              Asset Type
            </label>
            <select
              id="sim-asset-symbol"
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value as AssetSymbol)}
              className="w-full rounded-md border border-border bg-surface-primary px-3 py-2 text-xs font-medium text-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {Object.values(ASSET_RATES).map((asset) => (
                <option key={asset.symbol} value={asset.symbol}>
                  {asset.symbol} — {asset.name} (${asset.usdRate.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sim-network-fee" className="text-xs font-medium text-foreground-secondary flex items-center justify-between">
              <span>Estimated Network Fee</span>
              <span className="text-2xs text-foreground-muted">XLM</span>
            </label>
            <input
              id="sim-network-fee"
              type="number"
              min="0"
              step="0.00001"
              value={customFeeXlm}
              onChange={(e) => setCustomFeeXlm(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-primary px-3 py-2 text-xs font-mono text-foreground placeholder:text-foreground-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-secondary/40 p-3.5 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold shrink-0" aria-hidden="true" />
            <span className="text-foreground-secondary">Simulated Market Conversion:</span>
            <span className="tabular font-semibold text-foreground">
              {simulation.assetAmount} {simulation.assetSymbol} ≈ {formatCurrency(simulation.amountUsd, 'USD')}
            </span>
          </div>
          <div className="text-2xs text-foreground-muted">
            Fee: {simulation.networkFeeXlm} XLM ({formatCurrency(simulation.networkFeeUsd, 'USD')}) · Total: {formatCurrency(simulation.totalCostUsd, 'USD')}
          </div>
        </div>

        {simulation.warnings.length > 0 && (
          <div className="space-y-2" role="alert">
            {simulation.warnings.map((warning, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 rounded-md border p-3 text-xs ${
                  simulation.isPolicyViolation
                    ? 'border-danger/30 bg-danger-soft/30 text-danger'
                    : 'border-warning/30 bg-warning-soft/30 text-warning'
                }`}
              >
                {simulation.isPolicyViolation ? (
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {simulation.isPolicyViolation ? 'Policy Violation Detected' : 'Threshold Warning'}
                  </p>
                  <p className="text-foreground-secondary">{warning}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4 rounded-lg border border-border bg-surface-primary p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-gold" aria-hidden="true" />
              Before vs. After Budget Impact Preview
            </h4>
            <Badge variant={simulation.isPolicyViolation ? 'danger' : 'outline'} size="sm">
              {simulation.isPolicyViolation ? 'Violates Limit' : 'Within Budget Policy'}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-md border border-border/60 bg-surface-secondary/20 p-3">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-foreground-secondary font-medium">Current Utilization</span>
                <span className="tabular font-bold text-foreground">
                  {Math.round(simulation.currentUtilizationPct)}%
                </span>
              </div>
              <ProgressBar value={simulation.currentUtilizationPct} label="Current utilization" className="h-2" />
              <div className="flex justify-between text-2xs text-foreground-muted">
                <span>Spent: {formatCurrency(simulation.currentSpentUsd, 'USD')}</span>
                <span>Cap: {formatCurrency(simulation.dailyLimitUsd, 'USD')}</span>
              </div>
            </div>

            <div
              className={`space-y-2 rounded-md border p-3 ${
                simulation.isPolicyViolation
                  ? 'border-danger/40 bg-danger-soft/20'
                  : 'border-gold/40 bg-gold-soft/20'
              }`}
            >
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-foreground-secondary font-medium flex items-center gap-1">
                  <span>Simulated Utilization</span>
                  <ArrowRight className="h-3 w-3 text-gold" />
                </span>
                <span
                  className={`tabular font-bold ${
                    simulation.exceedsDailyLimit ? 'text-danger' : 'text-gold-strong'
                  }`}
                >
                  {Math.round(simulation.updatedUtilizationPct)}%
                </span>
              </div>
              <ProgressBar
                value={simulation.updatedUtilizationPct}
                label="Updated utilization after simulation"
                className="h-2"
              />
              <div className="flex justify-between text-2xs text-foreground-muted">
                <span>New Spent: {formatCurrency(simulation.updatedSpentUsd, 'USD')}</span>
                <span>Cap: {formatCurrency(simulation.dailyLimitUsd, 'USD')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-2xs">
          <div className="rounded-md border border-border p-2.5 bg-surface-secondary/20">
            <span className="text-foreground-muted block">Daily Envelope Limit</span>
            <span className="font-semibold text-foreground tabular">
              {formatCurrency(mergedConfig.dailyLimitUsd, 'USD')}
            </span>
          </div>
          <div className="rounded-md border border-border p-2.5 bg-surface-secondary/20">
            <span className="text-foreground-muted block">Single Tx Ceiling</span>
            <span className="font-semibold text-foreground tabular">
              {formatCurrency(mergedConfig.singleTxCeilingUsd, 'USD')}
            </span>
          </div>
          <div className="rounded-md border border-border p-2.5 bg-surface-secondary/20">
            <span className="text-foreground-muted block">Remaining Capacity</span>
            <span className="font-semibold text-success tabular">
              {formatCurrency(Math.max(0, simulation.dailyLimitUsd - simulation.updatedSpentUsd), 'USD')}
            </span>
          </div>
          <div className="rounded-md border border-border p-2.5 bg-surface-secondary/20">
            <span className="text-foreground-muted block">Policy Status</span>
            <span className={`font-semibold ${simulation.isPolicyViolation ? 'text-danger' : 'text-success'}`}>
              {simulation.isPolicyViolation ? 'Blocked' : 'Approved'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default BudgetSimulator;


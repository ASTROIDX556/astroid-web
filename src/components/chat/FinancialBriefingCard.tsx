'use client';

import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Wallet,
  Activity,
  CheckCircle,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';

export interface FinancialBriefingData {
  totalDailySpend: number;
  currency: string;
  activeAgentsCount: number;
  lowBalanceWalletsCount: number;
  topSpenderAgent: string;
  recommendation: string;
  spendRate?: 'increasing' | 'decreasing' | 'stable';
  budgetStatus?: 'healthy' | 'warning' | 'critical';
  anomalyDetected?: boolean;
}

interface FinancialBriefingCardProps {
  briefing: FinancialBriefingData;
  className?: string;
}

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  className?: string;
}

const VARIANT_STYLES = {
  default: 'text-foreground',
  warning: 'text-amber-400',
  success: 'text-success',
  danger: 'text-destructive',
} as const;

function MetricCard({ icon: Icon, label, value, variant = 'default', className }: MetricCardProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-2xs text-foreground-muted flex items-center gap-1">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </span>
      <p className={cn('font-semibold text-xs', VARIANT_STYLES[variant])}>{value}</p>
    </div>
  );
}

export function FinancialBriefingCard({ briefing, className }: FinancialBriefingCardProps) {
  const {
    totalDailySpend,
    currency,
    activeAgentsCount,
    lowBalanceWalletsCount,
    topSpenderAgent,
    recommendation,
    spendRate = 'stable',
    budgetStatus = lowBalanceWalletsCount > 0 ? 'warning' : 'healthy',
    anomalyDetected = false,
  } = briefing;

  const spendRateIcon: Record<typeof spendRate, LucideIcon> = {
    increasing: TrendingUp,
    decreasing: TrendingDown,
    stable: Activity,
  };

  const SpendRateIcon = spendRateIcon[spendRate];

  const budgetStatusBadge: Record<typeof budgetStatus, { label: string; variant: 'gold' | 'outline' | 'danger' }> = {
    healthy: { label: 'On Track', variant: 'gold' },
    warning: { label: 'Attention', variant: 'outline' },
    critical: { label: 'Critical', variant: 'danger' },
  };

  const statusInfo = budgetStatusBadge[budgetStatus];

  return (
    <div className={cn('space-y-2.5 rounded-button border border-border bg-surface p-3 text-2xs text-foreground', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-gold">Executive Summary</span>
          {anomalyDetected && (
            <Badge variant="danger" size="sm" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Anomaly
            </Badge>
          )}
        </div>
        <Badge variant={statusInfo.variant} size="sm">
          {statusInfo.label}
        </Badge>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <MetricCard
          icon={Wallet}
          label="Total Daily Spend"
          value={formatCurrency(totalDailySpend, currency)}
        />
        <MetricCard
          icon={Activity}
          label="Active Agents"
          value={`${activeAgentsCount} Agent${activeAgentsCount !== 1 ? 's' : ''}`}
        />
        <MetricCard
          icon={CheckCircle}
          label="Top Spender"
          value={topSpenderAgent}
          className="col-span-2"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Low Balance Wallets"
          value={`${lowBalanceWalletsCount} Warning${lowBalanceWalletsCount !== 1 ? 's' : ''}`}
          variant={lowBalanceWalletsCount > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          icon={SpendRateIcon}
          label="Spend Rate"
          value={spendRate.charAt(0).toUpperCase() + spendRate.slice(1)}
          variant={spendRate === 'increasing' ? 'warning' : spendRate === 'decreasing' ? 'success' : 'default'}
        />
      </div>

      {/* Recommendation */}
      <div className="pt-2 border-t border-border/50">
        <span className="text-foreground-muted flex items-center gap-1 font-medium">
          <Activity className="h-3 w-3" aria-hidden />
          AI Recommendation:
        </span>
        <p className="text-foreground font-medium italic mt-1 leading-relaxed">{recommendation}</p>
      </div>
    </div>
  );
}

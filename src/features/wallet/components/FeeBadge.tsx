'use client';

import { Zap, AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { CongestionState, FeeEstimate } from '@/hooks/useStellarFeeEstimate';

export interface FeeBadgeBalanceRisk {
  /** Severity tier for the badge treatment. */
  level: 'warning' | 'danger';
  /** Compact, self-describing label (never color alone). */
  label: string;
}

export interface FeeBadgeProps {
  feeEstimate: FeeEstimate;
  showDetails?: boolean;
  className?: string;
  /**
   * Optional fee-sufficiency verdict for the proposed transaction
   * (`amount + fee > balance` risk). When present and non-null, a warning or
   * danger badge is rendered alongside the congestion indicator (#245).
   * Omitted, the badge renders exactly as before.
   */
  balanceRisk?: FeeBadgeBalanceRisk | null;
}

const congestionConfig: Record<
  CongestionState,
  {
    variant: 'success' | 'warning' | 'danger';
    label: string;
    icon: typeof Zap;
  }
> = {
  low: {
    variant: 'success',
    label: 'Low Congestion',
    icon: Zap,
  },
  medium: {
    variant: 'warning',
    label: 'Moderate Congestion',
    icon: Clock,
  },
  high: {
    variant: 'danger',
    label: 'High Congestion',
    icon: AlertTriangle,
  },
};

/**
 * Compact FeeBadge UI component displaying current Stellar network fee rates,
 * estimated inclusion times, and congestion state indicators using design tokens.
 */
export function FeeBadge({
  feeEstimate,
  showDetails = true,
  className,
  balanceRisk,
}: FeeBadgeProps) {
  const config = congestionConfig[feeEstimate.congestion];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-1.5 text-xs',
        className,
      )}
    >
      <Badge variant={config.variant} dot size="sm">
        <span className="flex items-center gap-1 font-medium">
          <Icon className="h-3 w-3" aria-hidden />
          {config.label}
        </span>
      </Badge>

      {balanceRisk && (
        <Badge variant={balanceRisk.level} dot size="sm">
          <span
            className="flex items-center gap-1 font-medium"
            role="alert"
            aria-label={`Fee risk: ${balanceRisk.label}`}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {balanceRisk.label}
          </span>
        </Badge>
      )}
      
      {showDetails && (
        <div className="flex items-center gap-2 text-foreground-secondary">
          <span className="font-mono font-semibold text-foreground">
            {feeEstimate.suggestedFeeStroops} stroops
          </span>
          <span className="text-border-strong">•</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-foreground-muted" aria-hidden />
            {feeEstimate.inclusionLabel}
          </span>
        </div>
      )}
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
import { riskLevel } from '@/lib/status';
import { cn } from '@/lib/cn';

interface RiskBadgeProps {
  score: number;
  /** Show the numeric score alongside the label. */
  showScore?: boolean;
  className?: string;
}

/**
 * Risk indicator that never relies on color alone — it always carries a text
 * label ("Low", "Medium", "High", "Critical") and an optional numeric score,
 * so it reads correctly for color-blind users.
 */
export function RiskBadge({ score, showScore = false, className }: RiskBadgeProps) {
  const { label, variant } = riskLevel(score);
  return (
    <Badge variant={variant} dot className={className}>
      {label}
      {showScore && <span className="tabular ml-1 opacity-70">{score}</span>}
    </Badge>
  );
}

interface ProgressBarProps {
  /** 0–100. Values are clamped. */
  value: number;
  /** Tailwind height class; defaults to h-1.5. */
  className?: string;
  /** Override the fill color; defaults to gold, shifting to danger past 90%. */
  tone?: 'gold' | 'success' | 'warning' | 'danger' | 'auto';
  label?: string;
}

const toneFill: Record<
  Exclude<ProgressBarProps['tone'], undefined | 'auto'>,
  string
> = {
  gold: 'bg-gold',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/** Slim utilization bar used for budgets and quota displays. */
export function ProgressBar({
  value,
  className,
  tone = 'auto',
  label,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const resolved =
    tone === 'auto' ? (pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'gold') : tone;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-slow ease-astroid',
          toneFill[resolved],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

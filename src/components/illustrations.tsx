import { cn } from '@/lib/cn';

/**
 * A small custom illustration set (PRD: invest in a bespoke illustration set;
 * empty states are never "No Data"). Warm, editorial line art tuned to the token
 * palette — gold accents on neutral strokes.
 */

interface IlloProps {
  className?: string;
}

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function VaultIllustration({ className }: IlloProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('text-border-strong', className)}
      aria-hidden
    >
      <rect x="18" y="26" width="84" height="68" rx="8" {...strokeProps} />
      <circle cx="60" cy="60" r="20" {...strokeProps} />
      <circle cx="60" cy="60" r="7" className="text-gold" {...strokeProps} />
      <path d="M60 40v-6M60 86v-6M40 60h-6M86 60h-6" {...strokeProps} />
      <path d="M74 74l4 4M46 46l-4-4M74 46l4-4M46 74l-4 4" {...strokeProps} />
    </svg>
  );
}

export function AgentClusterIllustration({ className }: IlloProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('text-border-strong', className)}
      aria-hidden
    >
      <circle cx="60" cy="34" r="12" className="text-gold" {...strokeProps} />
      <circle cx="32" cy="82" r="12" {...strokeProps} />
      <circle cx="88" cy="82" r="12" {...strokeProps} />
      <path d="M52 44 40 70M68 44l12 26M44 82h32" {...strokeProps} />
    </svg>
  );
}

export function PolicyShieldIllustration({ className }: IlloProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('text-border-strong', className)}
      aria-hidden
    >
      <path
        d="M60 20l30 12v22c0 24-16 36-30 44-14-8-30-20-30-44V32z"
        {...strokeProps}
      />
      <path d="M48 60l9 9 18-20" className="text-gold" {...strokeProps} />
    </svg>
  );
}

export function MemoryIllustration({ className }: IlloProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('text-border-strong', className)}
      aria-hidden
    >
      <circle cx="34" cy="30" r="5" className="text-gold" {...strokeProps} />
      <circle cx="34" cy="60" r="5" {...strokeProps} />
      <circle cx="34" cy="90" r="5" {...strokeProps} />
      <path d="M34 35v20M34 65v20" {...strokeProps} />
      <rect x="52" y="22" width="46" height="16" rx="4" {...strokeProps} />
      <rect x="52" y="52" width="46" height="16" rx="4" {...strokeProps} />
      <rect x="52" y="82" width="46" height="16" rx="4" {...strokeProps} />
    </svg>
  );
}

export function ChartIllustration({ className }: IlloProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('text-border-strong', className)}
      aria-hidden
    >
      <path d="M24 92V28M24 92h72" {...strokeProps} />
      <path d="M36 80v-18M54 80V44M72 80V56M90 80V36" {...strokeProps} />
      <path d="M32 62l18-16 18 10 18-22" className="text-gold" {...strokeProps} />
    </svg>
  );
}

export function BellIllustration({ className }: IlloProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('text-border-strong', className)}
      aria-hidden
    >
      <path d="M42 54a18 18 0 0136 0c0 18 8 22 8 22H34s8-4 8-22z" {...strokeProps} />
      <path d="M54 84a6 6 0 0012 0" className="text-gold" {...strokeProps} />
    </svg>
  );
}

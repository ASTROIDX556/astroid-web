'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

export interface SignatureStatusBadgeProps {
  /** Signatures collected so far. */
  approved: number;
  /** Signatures required to meet the threshold. */
  required: number;
  /** Optional className for layout control by the consumer. */
  className?: string;
}

/**
 * Reusable signature-collection badge (#246 AC2) — a compact "2/3 signed"
 * status chip that never relies on color alone: the numeric progress is the
 * label text, and the accessible name spells out the threshold state. The
 * queue cards and any other surface that shows signature progress consume
 * this instead of duplicating the string.
 */
export function SignatureStatusBadge({ approved, required, className }: SignatureStatusBadgeProps) {
  const meetsThreshold = approved >= required;

  return (
    <Badge
      variant={meetsThreshold ? 'success' : 'warning'}
      size="sm"
      dot
      className={cn(className)}
      aria-label={`${approved} of ${required} signatures collected${
        meetsThreshold ? ', threshold met' : ', below threshold'
      }`}
    >
      {approved}/{required} signed
      {meetsThreshold && <span className="ml-1 opacity-70">· quorum met</span>}
    </Badge>
  );
}

/**
 * Pure signature-collection calculations for pending multi-signature
 * transactions. Keeping the maths outside the widget lets the same rules be
 * reused by dashboard cards and regression-tested without a React runtime.
 */

export type SignatureSignerStatus = 'signed' | 'pending' | 'rejected' | 'timed-out';

/** One key that must respond before a pending payload can be broadcast. */
export interface SignatureSigner {
  /** Stable client-side id. Falls back to the public key when absent. */
  id?: string;
  /** Ed25519 account public key of the signer. */
  publicKey: string;
  /** Human label rendered next to the key. */
  label?: string;
  /** Organisation role of the signer, e.g. "Treasury steward". */
  role?: string;
  status: SignatureSignerStatus;
  /** ISO timestamp of the signature, rejection, or timeout. */
  respondedAt?: string;
}

/** Aggregate visual state of a signature collection request. */
export type SignatureThresholdState = 'collecting' | 'ready' | 'timed-out' | 'blocked';

export interface SignatureProgress {
  /** Sanitised number of signatures the payload requires. */
  requiredSignatures: number;
  signedCount: number;
  pendingCount: number;
  rejectedCount: number;
  timedOutCount: number;
  totalSigners: number;
  /** Signatures still needed to meet the threshold. */
  remainingSignatures: number;
  /** Signed signatures as a percentage of the required threshold. */
  percentComplete: number;
  thresholdMet: boolean;
  /**
   * - `ready`: enough signatures collected, safe to broadcast.
   * - `collecting`: at least one signer can still meet the threshold.
   * - `timed-out`: the request expired with outstanding signatures.
   * - `blocked`: rejected/timed-out keys make the threshold unreachable.
   */
  state: SignatureThresholdState;
}

/** Human label for each per-signer status. */
export const SIGNATURE_SIGNER_STATUS_LABELS: Record<SignatureSignerStatus, string> = {
  signed: 'Signed',
  pending: 'Pending',
  rejected: 'Rejected',
  'timed-out': 'Timed out',
};

export function getSignatureSignerStatusLabel(status: SignatureSignerStatus): string {
  return SIGNATURE_SIGNER_STATUS_LABELS[status];
}

function sanitizeRequiredSignatures(requiredSignatures: number): number {
  if (!Number.isFinite(requiredSignatures)) return 0;
  return Math.max(0, Math.floor(requiredSignatures));
}

/**
 * Compute collection progress for a pending transaction.
 *
 * A payload is ready as soon as the signed count meets the threshold. A
 * request is blocked when the signed + pending keys can no longer reach it,
 * and timed out when every outstanding key stopped responding without a
 * rejection.
 */
export function computeSignatureProgress(
  signers: readonly SignatureSigner[],
  requiredSignatures: number,
): SignatureProgress {
  const required = sanitizeRequiredSignatures(requiredSignatures);

  let signedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  let timedOutCount = 0;

  for (const signer of signers) {
    switch (signer.status) {
      case 'signed':
        signedCount += 1;
        break;
      case 'rejected':
        rejectedCount += 1;
        break;
      case 'timed-out':
        timedOutCount += 1;
        break;
      case 'pending':
      default:
        pendingCount += 1;
        break;
    }
  }

  const thresholdMet = required === 0 || signedCount >= required;
  const reachable = signedCount + pendingCount;

  let state: SignatureThresholdState;
  if (thresholdMet) {
    state = 'ready';
  } else if (pendingCount === 0 && timedOutCount > 0) {
    state = 'timed-out';
  } else if (reachable < required) {
    state = 'blocked';
  } else {
    state = 'collecting';
  }

  return {
    requiredSignatures: required,
    signedCount,
    pendingCount,
    rejectedCount,
    timedOutCount,
    totalSigners: signers.length,
    remainingSignatures: Math.max(0, required - signedCount),
    percentComplete:
      required === 0 ? 100 : Math.min(100, Math.round((signedCount / required) * 100)),
    thresholdMet,
    state,
  };
}

/** Compact progress text shared by the widget and its tests, e.g. `2 / 3 signed`. */
export function formatSignatureProgress(progress: SignatureProgress): string {
  return `${progress.signedCount} / ${progress.requiredSignatures} signed`;
}

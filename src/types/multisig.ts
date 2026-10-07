/**
 * Domain types for the organization multi-signature signer management
 * dashboard (`/multisig`).
 *
 * Everything here describes the *account configuration* of an org multi-sig
 * Stellar account — the signer set and the master key thresholds — as opposed
 * to an individual signing request (see `@/features/approvals`).
 */

/** How a key participates in the multi-signature account. */
export type SignerKind = 'master' | 'co-signer' | 'pre-auth' | 'hash';

/** Lifecycle of a signer entry in the signer set. */
export type SignerStatus = 'active' | 'proposed' | 'removal-pending';

/** A single key on the organization multi-sig Stellar account. */
export interface OrgSigner {
  /** Stable client-side identifier. */
  id: string;
  /** Ed25519 account public key — a leading `G` plus 55 base32 characters. */
  publicKey: string;
  /** Human readable label rendered in the signer table. */
  label: string;
  /** Signature weight contributed by this key (0–255). */
  weight: number;
  kind: SignerKind;
  status: SignerStatus;
  /** ISO-8601 timestamp for when the signer entered the set. */
  addedAt: string;
}

/**
 * Master key thresholds. A transaction needs `low` weight for zero-value
 * operations, `medium` for standard payments and `high` for high-value or
 * account-modifying operations.
 */
export interface SignerThresholds {
  low: number;
  medium: number;
  high: number;
}

/** A staged weight change for an existing signer. */
export interface SignerWeightAdjustment {
  signerId: string;
  currentWeight: number;
  proposedWeight: number;
  /** Operator supplied justification, surfaced in the confirmation modal. */
  reason: string;
}

/** A single item inside a signer proposal — a discriminated union. */
export type SignerProposalChange =
  | {
      kind: 'add';
      signerId: string;
      label: string;
      publicKey: string;
      weight: number;
    }
  | {
      kind: 'adjust';
      signerId: string;
      label: string;
      currentWeight: number;
      proposedWeight: number;
      reason: string;
    }
  | {
      kind: 'remove';
      signerId: string;
      label: string;
      publicKey: string;
    }
  | {
      kind: 'thresholds';
      previous: SignerThresholds;
      next: SignerThresholds;
    };

export type SignerProposalStatus = 'pending' | 'approved' | 'rejected';

/** A submitted batch of signer/threshold changes awaiting co-signatures. */
export interface SignerProposal {
  id: string;
  changes: SignerProposalChange[];
  proposedBy: string;
  createdAt: string;
  status: SignerProposalStatus;
}

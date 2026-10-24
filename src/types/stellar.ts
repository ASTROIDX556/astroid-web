/**
 * Types for live Stellar account snapshots.
 *
 * A snapshot is the account-level view (native + trustline balances, ledger
 * sequence and transaction activity) that the wallet dashboard polls through
 * TanStack Query. USD valuation is intentionally not part of the snapshot: the
 * amounts are ledger-authoritative and are priced separately against the rates
 * feed so a stale price can never masquerade as a ledger balance.
 */

export type StellarAccountSource = 'horizon' | 'mock';

export interface StellarAccountBalance {
  /** Asset code, e.g. `XLM`, `USDC`. */
  asset: string;
  /** Issuer public key for trustline assets; `null` for the native asset. */
  issuer: string | null;
  /** Raw ledger amount in the asset's own units. */
  balance: number;
}

export interface StellarAccountSnapshot {
  /** The account the snapshot was fetched for. */
  publicKey: string;
  /** Balances as reported by the ledger, native asset first. */
  balances: StellarAccountBalance[];
  /** Ledger sequence as a decimal string (int64-safe). */
  sequence: string | null;
  /**
   * Number of recent transactions observed for the account, or `null` when the
   * activity feed could not be read. Horizon does not expose a total count, so
   * large accounts report a lower bound.
   */
  transactionCount: number | null;
  /** True when `transactionCount` is capped by the activity page size. */
  transactionCountIsLowerBound: boolean;
  /** Where this snapshot came from: the Stellar network or a local fixture. */
  source: StellarAccountSource;
  /** ISO timestamp of when the snapshot was produced. */
  fetchedAt: string;
}

/** A ledger balance paired with its current USD valuation. */
export interface StellarHolding extends StellarAccountBalance {
  usdValue: number;
}

/**
 * Status reconciliation between the shared Freighter store and a widget's own
 * connection attempt.
 *
 * `useFreighterStore` is the single source of truth for *whether a wallet is
 * connected and as whom*. `useStellarWallet` additionally tracks transient,
 * per-widget states that the store has no concept of (`checking` while it
 * validates, `missing` / `error` after a failed attempt). This helper merges
 * the two so every widget reports the same connection fact, immediately, while
 * keeping its own transient states.
 *
 * Pure and dependency-free so it can be unit-tested without React or a wallet.
 */

export type StellarWalletStatus = 'idle' | 'checking' | 'connected' | 'missing' | 'error';

export type SharedConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'locked';

/**
 * @param local - the widget's own status (its last attempt / validation)
 * @param shared - the shared store's connection status
 * @param sharedPublicKey - the shared store's connected account, if any
 */
export function deriveWalletStatus(
  local: StellarWalletStatus,
  shared: SharedConnectionStatus,
  sharedPublicKey: string | null,
): StellarWalletStatus {
  // The store says a wallet is connected as someone: that wins over any stale
  // local state, so a connection made by one widget shows up in all of them.
  if (shared === 'connected' && sharedPublicKey) return 'connected';

  // This widget last saw a live connection but the store no longer does (the
  // wallet was locked, switched away or disconnected elsewhere): never keep
  // reporting a stale "connected".
  if (local === 'connected') return 'idle';

  return local;
}

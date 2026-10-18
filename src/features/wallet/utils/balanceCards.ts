/**
 * Pure view-state helpers for the wallet balance cards.
 *
 * The balance cards fetch through React Query (`useWalletBalances`); these
 * helpers map the query's status flags onto the card section's view state and
 * normalize whatever the fetch rejected into a single renderable sentence, so
 * the component itself stays presentational.
 */
export type BalanceCardsViewState = 'loading' | 'error' | 'ready';

export interface BalanceCardsQueryFlags {
  isPending: boolean;
  isError: boolean;
}

/**
 * Resolve the balance-cards section state from React Query flags. A pending
 * first fetch wins (skeleton), then an errored fetch (error card with retry),
 * otherwise the ready content.
 */
export function resolveBalanceCardsState(flags: BalanceCardsQueryFlags): BalanceCardsViewState {
  if (flags.isPending) return 'loading';
  if (flags.isError) return 'error';
  return 'ready';
}

/** Number of asset rows the list-card skeleton mirrors at the card's dimensions. */
export const BALANCE_SKELETON_ROWS = 5;

/** Coerce an unknown rejection into a sentence that is safe to render in the card. */
export function balanceCardsErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return 'Balances could not be loaded. Check your connection and try again.';
}

import type { Transaction } from '@/types/domain';

/**
 * Wallet-scoped rows, newest first. Pure so the selection rule (`walletId`
 * match, `createdAt` descending) can be tested without React.
 */
export function selectWalletTransactions(
  transactions: readonly Transaction[],
  walletId: string,
): Transaction[] {
  return transactions
    .filter((tx) => tx.walletId === walletId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Total per-direction USD value of a transaction list, for the summary chips. */
export function sumByDirection(transactions: readonly Transaction[]): {
  inbound: number;
  outbound: number;
} {
  return transactions.reduce(
    (acc, tx) => {
      if (tx.direction === 'inbound') {
        acc.inbound += tx.usdValue;
      } else {
        acc.outbound += tx.usdValue;
      }
      return acc;
    },
    { inbound: 0, outbound: 0 },
  );
}

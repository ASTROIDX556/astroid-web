'use client';

import { AlertTriangle, Check, ChevronDown, RefreshCw, Wallet } from 'lucide-react';

import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import { useWallets } from '@/hooks/use-queries';
import { useFreighterStore } from '@/stores/freighter-store';
import {
  truncateWalletAddress,
  useWalletAccountStore,
} from '@/stores/wallet-store';
import { formatNumber } from '@/lib/format';
import type { Wallet as WorkspaceWallet } from '@/types/domain';

const EMPTY_WALLETS: WorkspaceWallet[] = [];

const STATUS_LABEL = {
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  locked: 'Wallet locked',
  error: 'Connection error',
} as const;

/**
 * Multi-account switcher for Freighter wallets.
 *
 * Lists every account observed in this session (funded and zero-balance alike),
 * highlights the active key, and delegates switching to the wallet store — which
 * invalidates wallet/balance queries and mirrors the active key into the
 * Freighter client. When the extension is disconnected it offers a reconnect
 * instead of an unusable list.
 */
export function WalletSwitcher() {
  const accounts = useWalletAccountStore((s) => s.accounts);
  const activePublicKey = useWalletAccountStore((s) => s.activePublicKey);
  const isSwitching = useWalletAccountStore((s) => s.isSwitching);
  const walletStatus = useFreighterStore((s) => s.status);
  const walletNetwork = useFreighterStore((s) => s.network);
  const connect = useFreighterStore((s) => s.connect);
  const switchAccount = useWalletAccountStore((s) => s.switchAccount);
  const walletsQuery = useWallets();
  const wallets = walletsQuery.data ?? EMPTY_WALLETS;

  const activeAccount = accounts.find((account) => account.publicKey === activePublicKey);
  const connected = walletStatus === 'connected';
  const network = activeAccount?.network ?? walletNetwork;

  const items: (DropdownItem | 'separator')[] = accounts.map((account) => {
    const wallet = wallets.find((entry) => entry.stellarAddress === account.publicKey);
    const xlm =
      account.balanceXlm ??
      wallet?.balances.find((balance) => balance.asset === 'XLM')?.balance;
    const isActive = account.publicKey === activePublicKey;

    return {
      label: account.label,
      description: `${truncateWalletAddress(account.publicKey)} · ${
        account.network ?? network ?? 'testnet'
      }`,
      icon: isActive ? (
        <Check className="h-4 w-4 text-gold" aria-hidden />
      ) : (
        <Wallet className="h-4 w-4" aria-hidden />
      ),
      trailing:
        xlm === 0 ? (
          <span
            className="inline-flex items-center gap-1 rounded-xs bg-warning-soft px-1.5 py-0.5 text-2xs text-warning"
            title="This account has a zero XLM balance. Switching is still allowed."
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Zero XLM
          </span>
        ) : xlm !== undefined ? (
          <span className="rounded-xs bg-surface-secondary px-1.5 py-0.5 text-2xs text-foreground-secondary">
            XLM {formatNumber(xlm, true)}
          </span>
        ) : undefined,
      disabled: !connected || isSwitching,
      onSelect: () => {
        void switchAccount(account.publicKey);
      },
    };
  });

  if (items.length > 0) items.push('separator');
  items.push({
    label: connected ? 'Reconnect Freighter' : 'Connect Freighter',
    description: connected
      ? `Refresh the account list · ${STATUS_LABEL[walletStatus]}`
      : 'Approve the connection in the browser extension',
    icon: <RefreshCw className={isSwitching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />,
    disabled: walletStatus === 'connecting',
    onSelect: () => {
      void connect();
    },
  });
  items.push({ label: 'Manage wallets', href: '/wallets' });

  const triggerLabel = activeAccount?.label ?? (connected ? 'Select account' : 'Connect wallet');
  const triggerAddress = activePublicKey
    ? truncateWalletAddress(activePublicKey)
    : STATUS_LABEL[walletStatus];

  return (
    <Dropdown
      aria-label="Switch wallet account"
      triggerClassName="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      className="min-w-[min(320px,calc(100vw-2rem))]"
      trigger={
        <span className="flex max-w-[200px] items-center gap-2 rounded-button border border-border bg-surface px-2.5 py-1.5 text-left transition-colors hover:bg-surface-secondary sm:max-w-[240px]">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              walletStatus === 'connected'
                ? 'bg-success'
                : walletStatus === 'connecting'
                  ? 'bg-warning'
                  : 'bg-danger'
            }`}
            aria-hidden
          />
          <span className="sr-only" role="status" aria-live="polite">
            {STATUS_LABEL[walletStatus]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">
              {triggerLabel}
            </span>
            <span className="block truncate font-mono text-2xs text-foreground-muted">
              {triggerAddress}
              {network ? ` · ${network}` : ''}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-hidden />
        </span>
      }
      items={items}
    />
  );
}

export default WalletSwitcher;

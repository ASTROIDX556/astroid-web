'use client';

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Plug,
  RefreshCw,
  Wallet2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import {
  STELLAR_NETWORKS,
  type StellarNetworkId,
} from '@/stores/freighter-store';
import { useWalletConnection } from '@/hooks/useWalletConnection';
import { cn } from '@/lib/cn';

/** Shared, brand-tinted focus ring for top-bar controls (WCAG AA). */
const WIDGET_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const NETWORK_IDS = Object.keys(STELLAR_NETWORKS) as StellarNetworkId[];

/**
 * Wallet status + Stellar network switcher for the dashboard header.
 *
 * Shows the connected Freighter account as a truncated public key with a
 * network badge, and lets the user choose which network the app targets
 * (Mainnet / Testnet / Futurenet). Freighter's extension owns its own active
 * network, so picking a target here re-syncs with the wallet and surfaces a
 * danger badge when the two disagree; signing then fails closed in
 * `useFreighterStore.requestSignature` rather than silently using the wrong
 * network. Account switches and disconnections propagate through
 * `WatchWalletChanges` inside {@link useWalletConnection}.
 */
export function WalletNetworkSwitcher() {
  const wallet = useWalletConnection();

  if (wallet.isConnecting) {
    return (
      <div
        role="status"
        aria-label="Freighter wallet: connecting"
        className="flex items-center gap-2 rounded-button border border-border bg-surface px-2.5 py-1 text-2xs text-foreground-muted"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" aria-hidden />
        <span>Connecting…</span>
      </div>
    );
  }

  if (!wallet.isConnected) {
    const failed = Boolean(wallet.error);
    return (
      <button
        type="button"
        onClick={() => void wallet.connect()}
        className={cn(
          'flex items-center gap-2 rounded-button border px-2.5 py-1.5 text-2xs font-medium transition-colors',
          failed
            ? 'border-danger/40 bg-danger-soft/20 text-danger hover:bg-danger-soft/30'
            : 'border-border bg-surface text-foreground-secondary hover:border-gold hover:bg-surface-secondary hover:text-foreground',
          WIDGET_FOCUS,
        )}
        aria-label={failed ? `Freighter wallet: ${wallet.error} Click to retry connection.` : 'Connect Freighter wallet'}
        title={wallet.error ?? 'Connect the Freighter wallet'}
      >
        {failed ? (
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Plug className="h-3.5 w-3.5" aria-hidden />
        )}
        <span className="font-mono">{failed ? 'Wallet error' : 'Connect Freighter'}</span>
      </button>
    );
  }

  const networkItems: (DropdownItem | 'separator')[] = [
    ...NETWORK_IDS.map((id) => ({
      label: STELLAR_NETWORKS[id].label,
      icon:
        id === wallet.targetNetwork ? <Check className="h-3.5 w-3.5 text-gold" aria-hidden /> : undefined,
      onSelect: () => void wallet.switchNetwork(id),
    })),
    'separator' as const,
    {
      label: 'Sync with Freighter',
      icon: <RefreshCw className={cn('h-3.5 w-3.5', wallet.isSwitching ? 'animate-spin text-gold' : 'text-foreground-muted')} aria-hidden />,
      onSelect: () => void wallet.refreshNetwork(),
    },
    'separator' as const,
    { label: 'Disconnect', onSelect: wallet.disconnect, destructive: true },
  ];

  const badgeLabel = wallet.networkMismatch
    ? `${wallet.walletNetworkLabel} → ${wallet.targetNetworkLabel}`
    : wallet.targetNetworkLabel;

  return (
    <Dropdown
      align="end"
      aria-label="Switch Stellar network"
      triggerClassName={cn(
        'rounded-button border border-border bg-surface transition-colors duration-fast hover:border-gold hover:bg-surface-secondary',
        WIDGET_FOCUS,
      )}
      trigger={
        <span className="flex items-center gap-2 px-2.5 py-1.5 text-2xs font-medium text-foreground-secondary">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                wallet.networkMismatch ? 'animate-ping bg-rose-400' : 'bg-emerald-400',
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                wallet.networkMismatch ? 'bg-rose-500' : 'bg-emerald-500',
              )}
            />
          </span>
          <Wallet2 className="h-3.5 w-3.5 text-gold" aria-hidden />
          <span className="hidden font-mono sm:inline-block">{wallet.truncatedPublicKey}</span>
          <Badge
            variant={wallet.networkMismatch ? 'danger' : 'success'}
            size="sm"
            className="text-3xs py-0 px-1.5"
          >
            {badgeLabel}
          </Badge>
          <ChevronDown className="h-3 w-3 text-foreground-muted" aria-hidden />
        </span>
      }
      items={networkItems}
    />
  );
}

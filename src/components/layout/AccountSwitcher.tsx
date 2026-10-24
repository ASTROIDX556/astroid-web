'use client';

import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, CircleOff, PlugZap, WalletCards } from 'lucide-react';

import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import { useWallets } from '@/hooks/use-queries';
import { queryKeys } from '@/services/query-keys';
import { useFreighterStore } from '@/stores/freighter-store';
import { formatNumber } from '@/lib/format';
import type { Wallet } from '@/types/domain';

const EMPTY_WALLETS: Wallet[] = [];

function truncateAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

function BalanceBadges({ wallet }: { wallet?: Pick<Wallet, 'balances'> }) {
  const xlm = wallet?.balances.find((balance) => balance.asset === 'XLM')?.balance;
  const usdc = wallet?.balances.find((balance) => balance.asset === 'USDC')?.balance;
  return (
    <span className="flex shrink-0 gap-1" aria-label={`XLM ${xlm ?? 'unavailable'}; USDC ${usdc ?? 'unavailable'}`}>
      <span className="rounded-xs bg-surface-secondary px-1.5 py-0.5 text-2xs text-foreground-secondary">XLM {xlm === undefined ? '—' : formatNumber(xlm, true)}</span>
      <span className="rounded-xs bg-surface-secondary px-1.5 py-0.5 text-2xs text-foreground-secondary">USDC {usdc === undefined ? '—' : formatNumber(usdc, true)}</span>
    </span>
  );
}

export function AccountSwitcher() {
  const queryClient = useQueryClient();
  const walletsQuery = useWallets();
  const wallets = walletsQuery.data ?? EMPTY_WALLETS;
  const activePublicKey = useFreighterStore((state) => state.publicKey);
  const activeNetwork = useFreighterStore((state) => state.network);
  const activeSource = activePublicKey ? 'freighter' : 'managed';
  const selectedWalletId: string | undefined = undefined;
  const connectedPublicKey = activePublicKey;
  const connectionStatus = useFreighterStore((state) => state.status);
  const hydrate = useFreighterStore((state) => state.hydrate);
  const startWatching = async () => () => undefined;
  const connect = useFreighterStore((state) => state.connect);
  const selectManagedAccount = (_wallet: Wallet) => undefined;
  const selectFreighterAccount = () => undefined;

  useEffect(() => {
    void hydrate();
    let stopWatching: (() => void) | undefined;
    let disposed = false;
    void startWatching().then((stop) => {
      if (disposed) stop();
      else stopWatching = stop;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      stopWatching?.();
    };
  }, [hydrate, startWatching]);

  const activeWallet = wallets.find((wallet) => wallet.id === selectedWalletId)
    ?? (activeSource === 'managed'
      ? wallets.find((wallet) => wallet.stellarAddress === activePublicKey)
      : undefined);
  const activeLabel = activeWallet?.name
    ?? (activeSource === 'freighter' && activePublicKey ? 'Freighter account' : 'Select account');
  const activeAddress = activeWallet?.stellarAddress ?? activePublicKey;
  const connectedWallet = wallets.find((wallet) => wallet.stellarAddress === connectedPublicKey);

  const walletItems = useMemo<DropdownItem[]>(() => wallets.map((wallet) => ({
    label: wallet.name,
    description: `${truncateAddress(wallet.stellarAddress)} · ${wallet.network}`,
    icon: selectedWalletId === wallet.id ? <Check className="h-4 w-4 text-gold" aria-hidden /> : <WalletCards className="h-4 w-4" aria-hidden />,
    trailing: <BalanceBadges wallet={wallet} />,
    onSelect: () => {
      selectManagedAccount(wallet);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallet(wallet.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.walletBalances(wallet.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.proposals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
      ]);
    },
  })), [queryClient, selectManagedAccount, selectedWalletId, wallets]);

  const items: (DropdownItem | 'separator')[] = [...walletItems];
  if (connectedPublicKey) {
    if (items.length) items.push('separator');
    items.push({
      label: 'Freighter account',
      description: `${truncateAddress(connectedPublicKey)} · ${activeNetwork ?? 'testnet'}`,
      icon: activeSource === 'freighter' ? <Check className="h-4 w-4 text-gold" aria-hidden /> : <PlugZap className="h-4 w-4" aria-hidden />,
      trailing: (
        <span className="flex items-center gap-1.5">
          <BalanceBadges wallet={connectedWallet} />
          <span className="rounded-xs bg-success-soft px-1.5 py-0.5 text-2xs text-success">Connected</span>
        </span>
      ),
      onSelect: () => {
        selectFreighterAccount();
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
          queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
          queryClient.invalidateQueries({ queryKey: queryKeys.proposals }),
          queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
        ]);
      },
    });
  } else {
    if (items.length) items.push('separator');
    items.push({
      label: 'Connect Freighter',
      description: 'Use the account selected in the browser extension',
      icon: <PlugZap className="h-4 w-4" aria-hidden />,
      disabled: connectionStatus === 'connecting',
      onSelect: () => {
        void connect().then((publicKey) => {
          if (publicKey) {
            void Promise.all([
              queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
              queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
              queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
            ]);
          }
        });
      },
    });
  }

  if (walletsQuery.isLoading && items.length === 0) {
    items.unshift({ label: 'Loading accounts…', disabled: true, icon: <WalletCards className="h-4 w-4" aria-hidden /> });
  } else if (items.length === 0) {
    items.unshift({ label: 'No accounts available', disabled: true, icon: <CircleOff className="h-4 w-4" aria-hidden /> });
  }

  return (
    <Dropdown
      align="start"
      aria-label="Switch Stellar account"
      triggerClassName="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      className="min-w-[min(440px,calc(100vw-2rem))]"
      trigger={(
        <span className="flex max-w-[220px] items-center gap-2 rounded-button border border-border bg-surface px-2.5 py-1.5 text-left hover:bg-surface-secondary sm:max-w-[280px]">
          <WalletCards className="h-4 w-4 shrink-0 text-gold" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">{activeLabel}</span>
            <span className="block truncate font-mono text-2xs text-foreground-muted">
              {activeAddress ? truncateAddress(activeAddress) : 'Disconnected'}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-hidden />
        </span>
      )}
      items={items}
    />
  );
}

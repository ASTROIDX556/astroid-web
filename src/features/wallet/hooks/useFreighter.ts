import { useStellarWallet } from '../../hooks/useStellarWallet';
import { useFreighterStore } from '../../stores/freighter-store';

export function useFreighter() {
  const wallet = useStellarWallet();
  const disconnect = () => useFreighterStore.getState().disconnect();
  const status = wallet.status === 'missing' ? 'not-installed' : wallet.status;
  return { ...wallet, status, disconnect };
}
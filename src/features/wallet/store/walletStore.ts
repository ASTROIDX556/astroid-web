import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WalletConnectionPhase, WalletNetwork, WalletState } from '../types';

interface WalletStoreState extends WalletState {
  setPhase: (phase: WalletConnectionPhase) => void;
  setPublicKey: (publicKey: string | null) => void;
  setNetwork: (network: WalletNetwork) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: WalletState = {
  activePublicKey: null,
  network: 'testnet',
  phase: 'disconnected',
  error: null,
};

export const useFreighterStore = create<WalletStoreState>()(
  persist(
    (set) => ({
      ...initialState,
      setPhase: (phase) => set({ phase }),
      setPublicKey: (publicKey) => set({ activePublicKey: publicKey }),
      setNetwork: (network) => set({ network }),
      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: 'astroid-wallet',
      partialize: (state) => ({
        activePublicKey: state.activePublicKey,
        network: state.network,
      }),
    },
  ),
);

export { useFreighterStore as useWalletStore };
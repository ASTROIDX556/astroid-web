export type AssetCode = 'XLM' | 'USDC' | 'EURC' | 'ASTRO';

export type AssetVerificationStatus = 'verified' | 'unverified';

export type AssetTrustlineStatus = 'trusted' | 'untrusted';

export interface StellarAsset {
  /** Short code, e.g. "USDC", "EUGC", "yXLM". Max 12 alphanumeric chars. */
  code: string;
  /** Stellar issuer public key (starts with 'G', 56 characters). */
  issuer: string;
  /** Human-readable name, e.g. "USD Coin". */
  name: string;
  balance: number;
  usdPrice: number;
  iconUrl?: string;
  issuer?: string;
  decimals: number;
}

export interface WalletSummary {
  totalUsdValue: number;
  assets: AssetBalance[];
  lastUpdated: string;
}

/** Wallet connection phase for the Freighter integration. */
export type WalletConnectionPhase =
  | 'not-installed'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

/** Supported Stellar networks. */
export type WalletNetwork = 'testnet' | 'mainnet';

/** Snapshot of the wallet connection state. */
export interface WalletState {
  /** Active public key, if connected. */
  activePublicKey: string | null;
  /** Currently selected network. */
  network: WalletNetwork;
  /** Current connection phase. */
  phase: WalletConnectionPhase;
  /** Last error message, if any. */
  error: string | null;
}

/** Actions available on the wallet store. */
export interface WalletActions {
  /** Sets the current connection phase. */
  setPhase: (phase: WalletConnectionPhase) => void;
  /** Sets the active public key. */
  setPublicKey: (publicKey: string | null) => void;
  /** Sets the active network. */
  setNetwork: (network: WalletNetwork) => void;
  /** Sets the last error message. */
  setError: (error: string | null) => void;
  /** Resets the wallet state, preserving the network. */
  reset: () => void;
}

/** Full shape of the Zustand wallet store. */
export type WalletStore = WalletState & WalletActions;

/** Return type of the `useFreighter` hook. */
export interface UseFreighterResult {
  state: WalletState;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (
    transactionXDR: string,
    options?: { networkPassphrase?: string; accountToSign?: string },
  ) => Promise<string>;
}
/** An asset entry in the Stellar Asset Directory. */

export type AssetVerificationStatus = 'verified' | 'unverified';

export type AssetTrustlineStatus = 'trusted' | 'untrusted';

export interface StellarAsset {
  /** Short code, e.g. "USDC", "EURC", "yXLM". Max 12 alphanumeric chars. */
  code: string;
  /** Stellar issuer public key (starts with 'G', 56 characters). */
  issuer: string;
  /** Human-readable name, e.g. "USD Coin". */
  name: string;
  /** Whether the issuer has been verified by the directory. */
  verification: AssetVerificationStatus;
  /** Whether the current wallet holds a trustline for this asset. */
  trustline: AssetTrustlineStatus;
}

export interface AddAssetFormValues {
  code: string;
  issuer: string;
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
  /** Initializes a connection to the Freighter extension. */
  connect: () => Promise<void>;
  /** Disconnects the active session and resets state. */
  disconnect: () => void;
  /** Signs a transaction XDR with the active account. */
  signTransaction: (transactionXDR: string) => Promise<string>;
  /** Sets the current connection phase. */
  setPhase: (phase: WalletConnectionPhase) => void;
  /** Sets the active public key. */
  setActivePublicKey: (publicKey: string | null) => void;
  /** Sets the active network. */
  setNetwork: (network: WalletNetwork) => void;
  /** Sets the last error message. */
  setError: (error: string | null) => void;
}

/** Full shape of the Zustand wallet store. */
export type WalletStore = WalletState & WalletActions;

/** Return type of the `useFreighter` hook. */
export interface UseFreighterResult {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (transactionXDR: string) => Promise<string>;
  phase: WalletConnectionPhase;
  activePublicKey: string | null;
  network: WalletNetwork;
  error: string | null;
}

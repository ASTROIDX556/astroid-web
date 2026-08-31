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

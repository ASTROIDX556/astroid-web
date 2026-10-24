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

/* -------------------------------------------------------------------------- */
/* Multi-currency balance breakdown                                            */
/* -------------------------------------------------------------------------- */

/**
 * Stellar asset types as Horizon reports them on an account's `balances`
 * array. `liquidity_pool_shares` entries are pool participations rather than
 * asset holdings and carry no code or issuer.
 */
export type HorizonAssetType =
  | 'native'
  | 'credit_alphanum4'
  | 'credit_alphanum12'
  | 'liquidity_pool_shares';

/**
 * A single entry from Horizon `GET /accounts/{id}` → `balances[]`, i.e. the
 * native XLM balance plus one entry per trustline.
 *
 * Amounts arrive as decimal strings (Stellar carries 7 decimal places and
 * values can exceed `Number.MAX_SAFE_INTEGER` in stroops), so every numeric
 * field is typed as the string Horizon actually sends.
 */
export interface HorizonBalance {
  /** Decimal string, e.g. `"1250.5500000"`. */
  balance: string;
  asset_type: HorizonAssetType;
  /** Absent for `native` and `liquidity_pool_shares`. */
  asset_code?: string;
  /** Issuer account id. Absent for `native` and `liquidity_pool_shares`. */
  asset_issuer?: string;
  /** Trustline ceiling as a decimal string; absent for `native`. */
  limit?: string;
  /** `false` when the issuer has frozen the trustline. */
  is_authorized?: boolean;
  /** Present only on `liquidity_pool_shares` entries. */
  liquidity_pool_id?: string;
}

/**
 * How a holding is presented in the breakdown. Drives the row icon, the badge,
 * and the chart series color.
 */
export type AssetClass = 'native' | 'stablecoin' | 'reward' | 'custom';

/** A parsed, display-ready holding derived from a {@link HorizonBalance}. */
export interface AssetHolding {
  /** Stable key for list rendering: `CODE:ISSUER`, or `XLM` for the native asset. */
  id: string;
  /** Asset code, or `XLM` for the native asset. */
  code: string;
  /** Issuer account id, or `null` for the native asset. */
  issuer: string | null;
  /** Whether {@link issuer} passes full StrKey validation (checksum included). */
  issuerVerified: boolean;
  /** Display name, falling back to the asset code when unknown. */
  name: string;
  assetClass: AssetClass;
  /** Token amount held. */
  amount: number;
  /** Unit price in USD; `0` when no rate is available. */
  priceUsd: number;
  /** `amount × priceUsd`. */
  usdValue: number;
  /** Trustline ceiling, or `null` when unlimited or not applicable. */
  limit: number | null;
  /** `false` when the issuer has frozen the trustline. */
  authorized: boolean;
  /** Share of the portfolio's total USD value, 0–100. */
  share: number;
}

/**
 * Pure, UI-independent edge-case primitives for the policy simulation engine (#245).
 *
 * The simulation view (`usePolicySimulation.ts`) evaluates XDR payloads against
 * policy rules. This module isolates the three edge-case families the issue
 * calls out — exact spending-limit boundary matches, custom Stellar asset
 * codes, and transaction-fee depletion in low-balance wallets — into typed
 * functions with no React, DOM, or network dependencies, so they can be
 * exercised independently of the widget (and unit tested in isolation).
 *
 * Strict TypeScript: zero `any`, zero `as` casts to untyped values.
 */

// ---------------------------------------------------------------------------
// Exact spending-limit boundary checks
// ---------------------------------------------------------------------------

export type AmountBoundaryOutcome = 'within' | 'at_limit' | 'over';

export interface AmountBoundaryCheck {
  outcome: AmountBoundaryOutcome;
  /** True when the amount is exactly equal to the cap — the boundary case. */
  atLimit: boolean;
  over: boolean;
  /** `amount - threshold`: negative within the cap, zero at the cap, positive over it. */
  delta: number;
}

/**
 * Classify a transaction amount against a spending-rule threshold, treating
 * the exact boundary (`amount === threshold`) as an explicit, distinguishable
 * outcome instead of silently folding it into "within".
 *
 * Returns `null` when either input is not a finite number, so callers can
 * degrade instead of coercing.
 */
export function evaluateAmountBoundary(
  amount: number,
  threshold: number,
): AmountBoundaryCheck | null {
  if (!Number.isFinite(amount) || !Number.isFinite(threshold)) {
    return null;
  }
  const delta = amount - threshold;
  const outcome: AmountBoundaryOutcome =
    delta > 0 ? 'over' : delta === 0 ? 'at_limit' : 'within';
  return { outcome, atLimit: outcome === 'at_limit', over: outcome === 'over', delta };
}

// ---------------------------------------------------------------------------
// Custom Stellar asset codes
// ---------------------------------------------------------------------------

/** The native Stellar asset is addressed as `XLM` in this app's vocabulary. */
export const NATIVE_ASSET_CODE = 'XLM';

/**
 * A Stellar asset code is 1–12 alphanumeric characters (ASCII); the native
 * asset is the reserved alias `XLM`. Trustline assets ("USD2", "USDC", custom
 * anchor codes) share the same shape, so one predicate covers both.
 */
export function isStellarAssetCode(code: string): boolean {
  return /^[A-Z0-9]{1,12}$/.test(code);
}

/** Trim + uppercase an asset code; returns `null` if it is not a valid code. */
export function normalizeAssetCode(value: string): string | null {
  const candidate = value.trim().toUpperCase();
  return isStellarAssetCode(candidate) ? candidate : null;
}

/** Mirror of `ParsedOperation` in `usePolicySimulation.ts`, kept structural so this module stays dependency-free. */
export interface AssetOperationRecord {
  type: string;
  asset: string;
  amount: string;
  source: string;
}

/**
 * Parse a plaintext, comma-delimited operation list into simulation
 * operations, so custom trustline asset codes can be produced and evaluated
 * end to end — the base64 heuristic decoder only ever emits `XLM`/`USDC`.
 *
 * Grammar (after whitespace normalization): one or more `;`-separated
 * records, each `type,assetCode,amount[,source]`. Every record must carry a
 * valid Stellar asset code and a finite non-negative amount, otherwise the
 * whole payload is rejected (`null`) and the caller falls back to the XDR
 * heuristic. Base64 XDR never contains commas, so this path cannot hijack
 * existing XDR input.
 */
export function parseAssetOperationList(payload: string): AssetOperationRecord[] | null {
  const compact = payload.trim().replace(/\s+/g, '');
  if (!compact.includes(',')) {
    return null;
  }

  const records = compact.split(';').filter((record) => record.length > 0);
  if (records.length === 0) {
    return null;
  }

  const parsed: AssetOperationRecord[] = [];
  for (const record of records) {
    const fields = record.split(',');
    if (fields.length < 3 || fields.length > 4) {
      return null;
    }
    const [rawType, rawAsset, rawAmount, rawSource] = fields as [
      string,
      string,
      string,
      string | undefined,
    ];
    const asset = normalizeAssetCode(rawAsset ?? '');
    const amount = Number(rawAmount);
    const type = (rawType ?? '').trim();
    if (!type || asset === null || !Number.isFinite(amount) || amount < 0) {
      return null;
    }
    parsed.push({
      type,
      asset,
      amount: rawAmount ?? '0',
      source: rawSource && rawSource.length > 0 ? rawSource : 'manual input',
    });
  }

  return parsed;
}

/**
 * Whether an operation asset passes an `allowed_assets` rule, treating the
 * native asset alias as a first-class code alongside trustlines.
 */
export function isAssetAllowed(asset: string, allowedAssets: readonly string[]): boolean {
  return allowedAssets.includes(asset);
}

// ---------------------------------------------------------------------------
// Fee-sufficiency (transaction-fee depletion in low-balance wallets)
// ---------------------------------------------------------------------------

export type FeeSufficiencyStatus = 'sufficient' | 'low' | 'insufficient' | 'invalid';

export interface FeeSufficiencyInput {
  /** Balance available to the signing account, in the same unit as the other fields. */
  availableBalance: number;
  /** Transaction amount being simulated, in the same unit. */
  transactionAmount: number;
  /** Network fee the transaction will be charged, in the same unit (stroops for XLM). */
  networkFee: number;
}

export interface FeeSufficiencyResult {
  status: FeeSufficiencyStatus;
  /** `availableBalance - transactionAmount - networkFee`; the fee reserve left after the tx. */
  remainingAfterTransaction: number;
}

/**
 * Decide whether a proposed transaction risks leaving insufficient balance
 * for the network fee itself — the low-balance-wallet depletion case:
 *
 * - `insufficient`: `amount + fee` exceeds the balance (the tx cannot pay its own fee);
 * - `low`: the remainder is positive but cannot cover even one more network fee;
 * - `sufficient`: a real fee reserve survives the transaction;
 * - `invalid`: any input is non-finite or negative — callers must not warn on
 *   garbage, they degrade silently.
 *
 * All fields share one unit (documented on {@link FeeSufficiencyInput}); for
 * XLM operations that unit is stroops.
 */
export function evaluateFeeSufficiency(input: FeeSufficiencyInput): FeeSufficiencyResult {
  const { availableBalance, transactionAmount, networkFee } = input;

  if (
    !Number.isFinite(availableBalance) ||
    !Number.isFinite(transactionAmount) ||
    !Number.isFinite(networkFee) ||
    availableBalance < 0 ||
    transactionAmount < 0 ||
    networkFee < 0
  ) {
    return { status: 'invalid', remainingAfterTransaction: Number.NaN };
  }

  const remainingAfterTransaction = availableBalance - transactionAmount - networkFee;

  if (remainingAfterTransaction < 0) {
    return { status: 'insufficient', remainingAfterTransaction };
  }
  if (remainingAfterTransaction < networkFee) {
    return { status: 'low', remainingAfterTransaction };
  }
  return { status: 'sufficient', remainingAfterTransaction };
}

// ---------------------------------------------------------------------------
// Presentation descriptors (still pure — strings only, no JSX)
// ---------------------------------------------------------------------------

export interface FeeSufficiencyViolationInfo {
  severity: 'warning' | 'danger';
  message: string;
}

/** Turn a fee-sufficiency verdict into the message the simulation violation list shows. */
export function describeFeeSufficiencyViolation(
  result: FeeSufficiencyResult,
  unitLabel: string,
): FeeSufficiencyViolationInfo | null {
  switch (result.status) {
    case 'insufficient':
      return {
        severity: 'danger',
        message: `Insufficient balance for network fees — the transaction plus the network fee exceeds the available balance by ${Math.abs(result.remainingAfterTransaction).toFixed(0)} ${unitLabel}.`,
      };
    case 'low':
      return {
        severity: 'warning',
        message: `Transaction leaves only ${result.remainingAfterTransaction} ${unitLabel} after fees — less than one network fee of reserve. A fee spike could strand the balance.`,
      };
    case 'sufficient':
    case 'invalid':
      return null;
  }
}

export interface FeeRiskBadgeDescriptor {
  level: 'warning' | 'danger';
  label: string;
}

/**
 * Compact badge descriptor for the fee-risk state, consumed by the shared
 * `FeeBadge` primitive. Returns `null` for `sufficient`/`invalid` verdicts so
 * the badge stays hidden when there is nothing to warn about.
 */
export function feeRiskBadgeDescriptor(result: FeeSufficiencyResult): FeeRiskBadgeDescriptor | null {
  switch (result.status) {
    case 'insufficient':
      return { level: 'danger', label: 'Balance below fees' };
    case 'low':
      return { level: 'warning', label: 'Low fee reserve' };
    case 'sufficient':
    case 'invalid':
      return null;
  }
}

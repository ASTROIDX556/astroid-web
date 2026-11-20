/**
 * Pure helpers for aggregating multi-currency Stellar wallet balances and converting them
 * into USD equivalents.
 *
 * All arithmetic is performed on fixed-point `bigint` units with {@link BALANCE_DECIMALS}
 * decimal places so sums such as `0.1 + 0.2` and conversions of tiny token amounts never
 * accumulate floating-point drift. Results are exposed both as exact decimal strings (for
 * display/export) and as numbers (for charts and sorting).
 *
 * None of the functions throw on bad data: invalid amounts are treated as zero and assets
 * without a usable exchange rate are reported in `unpricedAssets` instead.
 */

/** Number of decimal places preserved for balances, rates, and USD values. */
export const BALANCE_DECIMALS = 8;

const SCALE = 10n ** BigInt(BALANCE_DECIMALS);
const DECIMAL_PATTERN = /^([+-])?(\d*)(?:\.(\d*))?$/;

/** Identifies a Stellar asset. Native XLM has no issuer. */
export interface AssetIdentifier {
  /** Asset code, e.g. `XLM`, `USDC`. Matched case-insensitively. */
  code: string;
  /** Issuing account for non-native assets. */
  issuer?: string;
}

/** A single balance line, e.g. one asset held by one wallet. */
export interface AssetBalanceEntry extends AssetIdentifier {
  /** Amount held. Decimal strings are preferred to avoid float precision loss. */
  amount: number | string;
}

/**
 * USD price per unit of an asset. Keys may be an asset code (`USDC`) or a fully-qualified
 * `CODE:ISSUER` key; the qualified key wins when both exist. Keys are case-insensitive for
 * the code part.
 */
export type ExchangeRateMap = Readonly<Record<string, number | string>>;

export interface AggregatedAssetBalance extends AssetIdentifier {
  /** Stable grouping key: `CODE` for native/issuer-less assets, otherwise `CODE:ISSUER`. */
  assetKey: string;
  /** Exact total as a decimal string with {@link BALANCE_DECIMALS} places. */
  amount: string;
  /** Total as a number, for charts and sorting. */
  amountValue: number;
  /** How many balance lines were merged into this total. */
  entryCount: number;
}

export interface ValuedAssetBalance extends AggregatedAssetBalance {
  /** USD price per unit, or `null` when no valid rate is defined. */
  rateUsd: number | null;
  /** Exact USD value as a decimal string, or `null` when unpriced. */
  usdValue: string | null;
  /** USD value as a number, or `null` when unpriced. */
  usdValueNumber: number | null;
}

export interface PortfolioValuation {
  /** Exact USD total of all priced holdings. */
  totalUsd: string;
  /** USD total as a number. */
  totalUsdNumber: number;
  holdings: ValuedAssetBalance[];
  /** Asset keys that have a balance but no usable exchange rate. */
  unpricedAssets: string[];
}

/**
 * Converts a numeric or decimal-string amount into fixed-point units, rounding half away
 * from zero at {@link BALANCE_DECIMALS} places. Returns `null` for non-finite or
 * unparseable input.
 */
export function toFixedPointUnits(value: number | string): bigint | null {
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // toFixed avoids exponent notation (e.g. 1e-7) and keeps one guard digit for rounding.
    text = value.toFixed(BALANCE_DECIMALS + 1);
  } else {
    text = value.trim();
    if (/e/i.test(text)) {
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) return null;
      text = parsed.toFixed(BALANCE_DECIMALS + 1);
    }
  }

  const match = DECIMAL_PATTERN.exec(text);
  if (!match) return null;
  const [, sign, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return null;

  const padded = fraction.padEnd(BALANCE_DECIMALS + 1, '0');
  const kept = padded.slice(0, BALANCE_DECIMALS);
  const roundDigit = Number(padded[BALANCE_DECIMALS]);

  let units = BigInt(whole || '0') * SCALE + BigInt(kept || '0');
  if (roundDigit >= 5) units += 1n;
  return sign === '-' ? -units : units;
}

/** Formats fixed-point units as a decimal string with {@link BALANCE_DECIMALS} places. */
export function formatFixedPointUnits(units: bigint): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(BALANCE_DECIMALS, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Builds the grouping key for an asset (`XLM`, `USDC:GA5Z...`). */
export function getAssetKey(asset: AssetIdentifier): string {
  const code = asset.code.trim().toUpperCase();
  const issuer = asset.issuer?.trim();
  return issuer ? `${code}:${issuer}` : code;
}

/** Multiplies two fixed-point values, rounding half away from zero. */
function multiplyUnits(a: bigint, b: bigint): bigint {
  const product = a * b;
  const negative = product < 0n;
  const absolute = negative ? -product : product;
  const rounded = (absolute + SCALE / 2n) / SCALE;
  return negative ? -rounded : rounded;
}

function parseRate(value: number | string | undefined): bigint | null {
  if (value === undefined) return null;
  const units = toFixedPointUnits(value);
  return units !== null && units >= 0n ? units : null;
}

/**
 * Looks up the USD rate for an asset. Tries the fully-qualified `CODE:ISSUER` key first,
 * then the bare asset code. Returns fixed-point units, or `null` when the rate is missing,
 * negative, or not a finite number.
 */
export function resolveRateUnits(
  asset: AssetIdentifier,
  rates: ExchangeRateMap,
): bigint | null {
  const normalised = new Map<string, number | string>();
  for (const [key, rate] of Object.entries(rates)) {
    const separator = key.indexOf(':');
    const code = separator === -1 ? key : key.slice(0, separator);
    const issuer = separator === -1 ? undefined : key.slice(separator + 1);
    normalised.set(getAssetKey({ code, issuer }), rate);
  }
  const qualified = parseRate(normalised.get(getAssetKey(asset)));
  if (qualified !== null) return qualified;
  return parseRate(normalised.get(asset.code.trim().toUpperCase()));
}

/**
 * Converts an amount to USD at the given rate. Returns an exact decimal string with
 * {@link BALANCE_DECIMALS} places, or `null` if either input is invalid or the rate is
 * negative.
 */
export function convertToUsd(
  amount: number | string,
  rateUsd: number | string | undefined,
): string | null {
  const amountUnits = toFixedPointUnits(amount);
  const rateUnits = parseRate(rateUsd);
  if (amountUnits === null || rateUnits === null) return null;
  return formatFixedPointUnits(multiplyUnits(amountUnits, rateUnits));
}

/**
 * Groups balance lines by asset (code + issuer) and sums them exactly. Invalid amounts
 * contribute zero. Output order follows first appearance in the input.
 */
export function aggregateBalancesByAsset(
  balances: readonly AssetBalanceEntry[],
): AggregatedAssetBalance[] {
  const groups = new Map<
    string,
    { code: string; issuer?: string; units: bigint; entryCount: number }
  >();

  for (const entry of balances) {
    const code = entry.code.trim().toUpperCase();
    if (!code) continue;
    const issuer = entry.issuer?.trim() || undefined;
    const key = getAssetKey({ code, issuer });
    const units = toFixedPointUnits(entry.amount) ?? 0n;

    const existing = groups.get(key);
    if (existing) {
      existing.units += units;
      existing.entryCount += 1;
    } else {
      groups.set(key, { code, issuer, units, entryCount: 1 });
    }
  }

  return Array.from(groups, ([assetKey, group]) => {
    const amount = formatFixedPointUnits(group.units);
    return {
      code: group.code,
      ...(group.issuer ? { issuer: group.issuer } : {}),
      assetKey,
      amount,
      amountValue: Number(amount),
      entryCount: group.entryCount,
    };
  });
}

/**
 * Aggregates balances by asset and values each holding in USD using the given rate map.
 * Assets with a non-zero balance but no usable rate are listed in `unpricedAssets` and
 * excluded from the total; zero balances never count as unpriced.
 */
export function calculatePortfolioValue(
  balances: readonly AssetBalanceEntry[],
  rates: ExchangeRateMap,
): PortfolioValuation {
  let totalUnits = 0n;
  const unpricedAssets: string[] = [];

  const holdings = aggregateBalancesByAsset(balances).map(
    (holding): ValuedAssetBalance => {
      const rateUnits = resolveRateUnits(holding, rates);
      if (rateUnits === null) {
        if (holding.amountValue !== 0) unpricedAssets.push(holding.assetKey);
        return { ...holding, rateUsd: null, usdValue: null, usdValueNumber: null };
      }

      const amountUnits = toFixedPointUnits(holding.amount) ?? 0n;
      const usdUnits = multiplyUnits(amountUnits, rateUnits);
      totalUnits += usdUnits;
      const usdValue = formatFixedPointUnits(usdUnits);
      return {
        ...holding,
        rateUsd: Number(formatFixedPointUnits(rateUnits)),
        usdValue,
        usdValueNumber: Number(usdValue),
      };
    },
  );

  const totalUsd = formatFixedPointUnits(totalUnits);
  return {
    totalUsd,
    totalUsdNumber: Number(totalUsd),
    holdings,
    unpricedAssets,
  };
}

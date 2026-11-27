import { z } from 'zod';

/**
 * ---------------------------------------------------------------------------
 * Zod Schemas for Validation
 * ---------------------------------------------------------------------------
 */

/** Schema for a single balance input item. */
export const balanceItemSchema = z
  .object({
    asset: z.string().trim().min(1, 'Asset identifier is required.'),
    balance: z.union([z.number(), z.string()]).optional(),
    amount: z.union([z.number(), z.string()]).optional(),
    usdValue: z.number().nonnegative().optional(),
  })
  .passthrough()
  .refine(
    (data) => data.balance !== undefined || data.amount !== undefined,
    { message: 'Either balance or amount must be specified.' },
  );

/** Schema for an array of balance items. */
export const balancesArraySchema = z.array(balanceItemSchema);

/** Schema for a single rate record in price feed array. */
export const assetRateItemSchema = z
  .object({
    asset: z.string().trim().min(1),
    priceUsd: z.number().finite().nonnegative(),
  })
  .passthrough();

/** Schema for price feed inputs. */
export const priceFeedMapSchema = z.record(
  z.string(),
  z.union([z.number().finite().nonnegative(), z.null(), z.undefined()]),
);

/**
 * ---------------------------------------------------------------------------
 * Types & Interfaces
 * ---------------------------------------------------------------------------
 */

/** Raw balance item passed into the aggregator. */
export interface BalanceInput {
  asset: string;
  balance?: number | string;
  amount?: number | string;
  usdValue?: number;
  [key: string]: unknown;
}

/** Rate item shape compatible with Astroid API AssetRate. */
export interface AssetRateQuote {
  asset: string;
  priceUsd: number;
  [key: string]: unknown;
}

/** Accepted price feed inputs. */
export type PriceFeedInput =
  | Record<string, number | null | undefined>
  | AssetRateQuote[]
  | Map<string, number>;

/** Configuration options for the balance aggregation. */
export interface AggregationOptions {
  /** Include assets with a total balance of zero (default: true). */
  includeZeroBalances?: boolean;
  /** Fiat currency code used in formatted output (default: 'USD'). */
  fiatCurrency?: string;
  /** How to sort the resulting asset list (default: 'usdDesc'). */
  sortBy?: 'usdDesc' | 'balanceDesc' | 'assetAsc';
  /** Throw Zod error on invalid item rather than skipping (default: false). */
  strictValidation?: boolean;
}

/** Aggregated summary for a single asset. */
export interface AggregatedAssetBalance {
  /** Normalized asset code / ticker (e.g., 'XLM', 'USDC'). */
  asset: string;
  /** Aggregated total balance amount as a finite number. */
  balance: number;
  /** Balance formatted with standard token precision. */
  balanceFormatted: string;
  /** Conversion rate to USD, or null if missing/unavailable. */
  usdRate: number | null;
  /** Estimated USD value, or null if exchange rate is missing. */
  usdValue: number | null;
  /** Formatted USD value (e.g. "$1,234.56"), or fallback "—" when missing. */
  usdValueFormatted: string;
  /** Percentage of portfolio USD value (0-100), or null if total USD is 0 or rate missing. */
  allocationPercentage: number | null;
  /** True when the exchange rate for this asset was missing or invalid. */
  hasMissingRate: boolean;
  /** Count of raw balance items aggregated into this asset. */
  count: number;
}

/** Overall treasury balance aggregation result. */
export interface BalanceAggregationResult {
  /** Total estimated USD value across all assets with available exchange rates. */
  totalUsdValue: number;
  /** Formatted total USD value (e.g. "$10,500.00"). */
  totalUsdValueFormatted: string;
  /** List of aggregated asset balances. */
  assets: AggregatedAssetBalance[];
  /** Lookup map keyed by upper-case asset identifier. */
  byAsset: Record<string, AggregatedAssetBalance>;
  /** Total unique asset codes represented. */
  uniqueAssetCount: number;
  /** Total count of balance entries processed. */
  totalItemsCount: number;
  /** True if any asset with non-zero balance is missing an exchange rate. */
  hasMissingRates: boolean;
  /** Asset codes that lacked a valid exchange rate. */
  missingRateAssets: string[];
}

/**
 * ---------------------------------------------------------------------------
 * Normalization & Formatting Helpers
 * ---------------------------------------------------------------------------
 */

/** Extract clean upper-case asset code (e.g. "USDC:GA5Z..." -> "USDC"). */
export function normalizeAssetCode(asset: string): string {
  const trimmed = asset.trim().toUpperCase();
  const colonIndex = trimmed.indexOf(':');
  return colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex);
}

/** Safe parse string or number into finite positive/zero float. */
export function parseBalanceAmount(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  const str = String(value).trim();
  if (!str) return 0;
  const parsed = Number(str);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Format an asset balance amount with up to 7 decimal places (Stellar stroops). */
export function formatTokenAmount(amount: number, asset: string): string {
  const maxDecimals = asset === 'XLM' || asset === 'AQUA' ? 4 : 2;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(amount);
}

/** Format fiat currency with standard 2 decimal places and currency symbol. */
export function formatFiat(amount: number | null | undefined, fallback: string = '—'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return fallback;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Converts a raw amount to USD given an exchange rate.
 * Returns null if the rate is missing, non-finite, or negative.
 */
export function convertAssetToUsd(
  amount: number | string,
  rate: number | null | undefined,
): number | null {
  const numericAmount = parseBalanceAmount(amount);
  if (rate === null || rate === undefined || !Number.isFinite(rate) || rate < 0) {
    return null;
  }
  // Stellar stroop precision: round to 7 decimal places
  const product = numericAmount * rate;
  return Math.round(product * 1e7) / 1e7;
}

/**
 * Normalizes price feed rates into a fast lookup Map keyed by upper-case asset code.
 */
export function normalizePriceFeed(feed?: PriceFeedInput | null): Map<string, number> {
  const rateMap = new Map<string, number>();
  if (!feed) return rateMap;

  if (feed instanceof Map) {
    for (const [key, val] of feed.entries()) {
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
        rateMap.set(key.trim().toUpperCase(), val);
        const code = normalizeAssetCode(key);
        if (!rateMap.has(code)) rateMap.set(code, val);
      }
    }
    return rateMap;
  }

  if (Array.isArray(feed)) {
    for (const item of feed) {
      if (item && typeof item === 'object' && 'asset' in item && typeof item.asset === 'string') {
        const parsed = assetRateItemSchema.safeParse(item);
        if (parsed.success) {
          const upper = parsed.data.asset.trim().toUpperCase();
          rateMap.set(upper, parsed.data.priceUsd);
          const code = normalizeAssetCode(upper);
          if (!rateMap.has(code)) rateMap.set(code, parsed.data.priceUsd);
        }
      }
    }
    return rateMap;
  }

  if (typeof feed === 'object') {
    for (const [key, val] of Object.entries(feed)) {
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
        const upper = key.trim().toUpperCase();
        rateMap.set(upper, val);
        const code = normalizeAssetCode(upper);
        if (!rateMap.has(code)) rateMap.set(code, val);
      }
    }
  }

  return rateMap;
}

/**
 * ---------------------------------------------------------------------------
 * Main Balance Aggregation Utility
 * ---------------------------------------------------------------------------
 *
 * Aggregates multi-currency asset balances by asset code and computes real-time
 * fiat estimation. Gracefully handles missing exchange rates, malformed records,
 * and zero balances.
 */
export function aggregateBalances(
  balances: unknown,
  priceFeed?: PriceFeedInput | null,
  options: AggregationOptions = {},
): BalanceAggregationResult {
  const {
    includeZeroBalances = true,
    sortBy = 'usdDesc',
    strictValidation = false,
  } = options;

  // Validate or coerce balance array
  let rawList: unknown[] = [];
  if (Array.isArray(balances)) {
    rawList = balances;
  } else if (strictValidation) {
    throw new Error('Input balances must be an array.');
  }

  const rateLookup = normalizePriceFeed(priceFeed);

  // Group and aggregate by asset code
  interface Accumulator {
    rawAsset: string;
    totalAmount: number;
    count: number;
  }
  const groupMap = new Map<string, Accumulator>();
  let totalItemsCount = 0;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') {
      if (strictValidation) {
        throw new Error('Invalid balance item encountered.');
      }
      continue;
    }

    const validation = balanceItemSchema.safeParse(item);
    if (!validation.success) {
      if (strictValidation) {
        throw new Error(`Invalid balance item: ${validation.error.message}`);
      }
      continue;
    }

    totalItemsCount += 1;
    const { asset, balance, amount } = validation.data;
    const code = normalizeAssetCode(asset);
    const parsedAmount = parseBalanceAmount(balance ?? amount);

    const existing = groupMap.get(code);
    if (existing) {
      // Safe addition to 7 decimal places
      existing.totalAmount = Math.round((existing.totalAmount + parsedAmount) * 1e7) / 1e7;
      existing.count += 1;
    } else {
      groupMap.set(code, {
        rawAsset: code,
        totalAmount: parsedAmount,
        count: 1,
      });
    }
  }

  // Build aggregated asset balance items
  const aggregatedList: AggregatedAssetBalance[] = [];
  const byAsset: Record<string, AggregatedAssetBalance> = {};
  const missingRateAssets: string[] = [];
  let totalUsdValue = 0;

  for (const [code, acc] of groupMap.entries()) {
    if (!includeZeroBalances && acc.totalAmount === 0) {
      continue;
    }

    // Lookup rate by full code or ticker
    const rate = rateLookup.get(code) ?? null;
    const hasMissingRate = rate === null;
    const usdValue = convertAssetToUsd(acc.totalAmount, rate);

    if (hasMissingRate && acc.totalAmount > 0) {
      missingRateAssets.push(code);
    }

    if (usdValue !== null) {
      totalUsdValue = Math.round((totalUsdValue + usdValue) * 1e7) / 1e7;
    }

    const item: AggregatedAssetBalance = {
      asset: code,
      balance: acc.totalAmount,
      balanceFormatted: formatTokenAmount(acc.totalAmount, code),
      usdRate: rate,
      usdValue,
      usdValueFormatted: formatFiat(usdValue),
      allocationPercentage: null, // computed below after totalUsdValue is known
      hasMissingRate,
      count: acc.count,
    };

    aggregatedList.push(item);
    byAsset[code] = item;
  }

  // Compute allocation percentage based on total USD value
  for (const item of aggregatedList) {
    if (item.usdValue !== null && totalUsdValue > 0) {
      const percentage = (item.usdValue / totalUsdValue) * 100;
      item.allocationPercentage = Math.round(percentage * 100) / 100;
    } else {
      item.allocationPercentage = null;
    }
  }

  // Sort aggregated asset list
  aggregatedList.sort((a, b) => {
    switch (sortBy) {
      case 'usdDesc': {
        const valA = a.usdValue ?? -1;
        const valB = b.usdValue ?? -1;
        if (valB !== valA) return valB - valA;
        return b.balance - a.balance;
      }
      case 'balanceDesc':
        return b.balance - a.balance;
      case 'assetAsc':
        return a.asset.localeCompare(b.asset);
      default:
        return 0;
    }
  });

  return {
    totalUsdValue,
    totalUsdValueFormatted: formatFiat(totalUsdValue),
    assets: aggregatedList,
    byAsset,
    uniqueAssetCount: aggregatedList.length,
    totalItemsCount,
    hasMissingRates: missingRateAssets.length > 0,
    missingRateAssets,
  };
}

import { isValidStellarPublicKey } from '@/lib/stellar';
import type { AssetClass, AssetHolding, HorizonBalance } from '@/features/wallet/types';

/**
 * Parsing for Horizon account balances.
 *
 * Horizon reports the native XLM balance and every trustline in one
 * `balances[]` array, with amounts as decimal strings and no pricing. These
 * helpers turn that wire shape into the display-ready {@link AssetHolding}
 * rows the breakdown widget renders — tolerating missing fields, unparseable
 * amounts, and unknown asset types rather than throwing on them.
 */

/** Asset codes the dashboard knows by name, with their presentation class. */
const KNOWN_ASSETS: Readonly<Record<string, { name: string; assetClass: AssetClass }>> =
  {
    XLM: { name: 'Stellar Lumens', assetClass: 'native' },
    USDC: { name: 'USD Coin', assetClass: 'stablecoin' },
    EURC: { name: 'Euro Coin', assetClass: 'stablecoin' },
    yUSDF: { name: 'yUSDF', assetClass: 'stablecoin' },
    USDT: { name: 'Tether USD', assetClass: 'stablecoin' },
    ARST: { name: 'Argentine Peso', assetClass: 'stablecoin' },
    AGNT: { name: 'Agent Reward Token', assetClass: 'reward' },
    ASTR: { name: 'Astroid Credit', assetClass: 'reward' },
    AQUA: { name: 'Aquarius', assetClass: 'custom' },
    yXLM: { name: 'yXLM', assetClass: 'custom' },
  };

/** Codes that are stablecoins by convention even when not in {@link KNOWN_ASSETS}. */
const STABLECOIN_PATTERN = /^(y?)(USD|EUR|GBP|BRL|NGN|ARS)[A-Z0-9]{0,6}$/;

/**
 * Parse a Horizon decimal amount string.
 * Returns `null` for anything that is not a finite number, so callers can
 * decide whether to drop the row or show it as zero.
 */
function parseAmount(value: string | undefined): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Classify an asset code for icon, badge, and chart color selection. */
export function classifyAsset(code: string, isNative: boolean): AssetClass {
  if (isNative) return 'native';
  const known = KNOWN_ASSETS[code];
  if (known) return known.assetClass;
  if (STABLECOIN_PATTERN.test(code)) return 'stablecoin';
  return 'custom';
}

/**
 * Turn Horizon account balances into sorted, display-ready holdings.
 *
 * Entries that cannot describe a holding are skipped rather than rendered as
 * broken rows: liquidity pool shares (a pool participation, not an asset), and
 * credit balances missing a code or an amount.
 *
 * @param balances Raw `balances[]` from Horizon, or an equivalent API payload.
 * @param pricesUsd Unit prices keyed by asset code. Missing codes price at `0`,
 *   which keeps the holding visible with its token amount but out of the
 *   value-share chart.
 * @returns Holdings sorted by USD value descending, with the native asset
 *   first, each carrying its share of total portfolio value.
 *
 * @example
 * parseTrustlineBalances(account.balances, { XLM: 0.1184, USDC: 1 });
 */
export function parseTrustlineBalances(
  balances: readonly HorizonBalance[] | null | undefined,
  pricesUsd: Readonly<Record<string, number>> = {},
): AssetHolding[] {
  if (!Array.isArray(balances)) return [];

  const holdings: AssetHolding[] = [];

  for (const entry of balances) {
    if (entry === null || typeof entry !== 'object') continue;
    // Pool shares are a participation in a liquidity pool, not an asset holding.
    if (entry.asset_type === 'liquidity_pool_shares') continue;

    const isNative = entry.asset_type === 'native';
    const code = isNative ? 'XLM' : (entry.asset_code ?? '').trim();
    if (code.length === 0) continue;

    const amount = parseAmount(entry.balance);
    if (amount === null) continue;

    const issuer = isNative ? null : (entry.asset_issuer ?? '').trim() || null;
    const price = pricesUsd[code];
    const priceUsd = typeof price === 'number' && Number.isFinite(price) ? price : 0;
    const limit = isNative ? null : parseAmount(entry.limit);

    holdings.push({
      id: issuer === null ? code : `${code}:${issuer}`,
      code,
      issuer,
      issuerVerified: issuer === null ? true : isValidStellarPublicKey(issuer),
      name: KNOWN_ASSETS[code]?.name ?? code,
      assetClass: classifyAsset(code, isNative),
      amount,
      priceUsd,
      usdValue: amount * priceUsd,
      limit,
      authorized: entry.is_authorized !== false,
      share: 0,
    });
  }

  const totalUsd = holdings.reduce((sum, holding) => sum + holding.usdValue, 0);

  return holdings
    .map((holding) => ({
      ...holding,
      share: totalUsd > 0 ? (holding.usdValue / totalUsd) * 100 : 0,
    }))
    .sort((a, b) => {
      // The native asset anchors the list; everything else ranks by value.
      if (a.assetClass === 'native') return -1;
      if (b.assetClass === 'native') return 1;
      if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
      return a.code.localeCompare(b.code);
    });
}

/** Sum of a holdings list in USD. */
export function totalHoldingsValue(holdings: readonly AssetHolding[]): number {
  return holdings.reduce((sum, holding) => sum + holding.usdValue, 0);
}

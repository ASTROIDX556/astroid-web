import type { AssetRate } from '@/types/domain';

/**
 * Format a Stellar asset price with appropriate precision.
 * - XLM / native: 4 decimal places (e.g. 0.1184)
 * - Stablecoins (USDC, yUSDF): 2–4 decimals based on magnitude
 * - Small-cap tokens: scientific-like with significant figures
 */
export function formatStellarPrice(priceUsd: number): string {
  if (priceUsd === 0) return '$0.00';
  if (priceUsd >= 1) {
    return `$${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(priceUsd)}`;
  }
  if (priceUsd >= 0.01) {
    return `$${priceUsd.toFixed(4)}`;
  }
  // Sub-cent assets — show enough precision to be meaningful
  return `$${priceUsd.toFixed(6)}`;
}

/**
 * Format an asset amount with its symbol for display in the ticker.
 * Stellar standard precision: 7 decimal places max (stroops).
 */
export function formatAssetAmount(
  amount: number,
  asset: string,
  options: { compact?: boolean } = {},
): string {
  const { compact = false } = options;

  if (compact) {
    const formatted = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
    return `${formatted} ${asset}`;
  }

  const maxDecimals = asset === 'XLM' || asset === 'AQUA' ? 4 : 2;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(amount);
  return `${formatted} ${asset}`;
}

/**
 * Convert an amount of a Stellar asset to USD using a rate lookup.
 */
export function convertToUsd(
  amount: number,
  rates: AssetRate[],
  asset: string,
): number | null {
  const rate = rates.find((r) => r.asset === asset);
  if (!rate) return null;
  return amount * rate.priceUsd;
}

/**
 * Sort asset rates with native XLM first, then stablecoins, then alphabetical.
 */
export function sortAssetRates(rates: AssetRate[]): AssetRate[] {
  const stablecoins = new Set(['USDC', 'yUSDF']);
  const native = new Set(['XLM']);

  return [...rates].sort((a, b) => {
    if (native.has(a.asset)) return -1;
    if (native.has(b.asset)) return 1;
    if (stablecoins.has(a.asset) && !stablecoins.has(b.asset)) return -1;
    if (!stablecoins.has(a.asset) && stablecoins.has(b.asset)) return 1;
    return a.asset.localeCompare(b.asset);
  });
}

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

/* -------------------------------------------------------------------------- */
/* Public key (address) validation and formatting                              */
/* -------------------------------------------------------------------------- */

/**
 * Length of a StrKey-encoded Stellar ed25519 account id: a `G` prefix plus 55
 * base32 characters, encoding 1 version byte + 32 key bytes + 2 checksum bytes.
 */
export const STELLAR_PUBLIC_KEY_LENGTH = 56;

/**
 * Shape of a Stellar account id. Matches the `G` prefix and the RFC 4648
 * base32 alphabet (`A–Z`, `2–7`) — padding and lowercase are never valid.
 *
 * This is a *shape* check only; it does not verify the trailing CRC-16
 * checksum. Use {@link isValidStellarPublicKey} for full verification.
 */
export const STELLAR_PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;

/** Version byte prefixing an ed25519 account id payload (`6 << 3`). */
const ED25519_PUBLIC_KEY_VERSION_BYTE = 0x30;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Why a candidate address was rejected. */
export type StellarAddressErrorCode =
  | 'not-a-string'
  | 'empty'
  | 'invalid-length'
  | 'invalid-prefix'
  | 'invalid-characters'
  | 'invalid-checksum';

/** Result of validating a candidate Stellar account id. */
export type StellarAddressValidation =
  | { readonly valid: true; readonly address: string }
  | {
      readonly valid: false;
      readonly code: StellarAddressErrorCode;
      /** Operator-facing explanation, safe to render inline under an input. */
      readonly message: string;
    };

/** Options for {@link formatStellarAddress}. */
export interface FormatStellarAddressOptions {
  /** Characters kept from the start of the address. Default `4`. */
  lead?: number;
  /** Characters kept from the end of the address. Default `4`. */
  tail?: number;
  /** Separator placed between the two halves. Default `'…'`. */
  separator?: string;
  /** Rendered when the value is missing or unusable. Default `'—'`. */
  fallback?: string;
  /** When `true`, only a checksum-valid account id is truncated. Default `false`. */
  strict?: boolean;
}

/**
 * Decode base32 (RFC 4648, no padding) into bytes.
 * Returns `null` on any character outside the alphabet.
 */
function decodeBase32(input: string): Uint8Array | null {
  const bytes = new Uint8Array(Math.floor((input.length * 5) / 8));
  let accumulator = 0;
  let bits = 0;
  let offset = 0;

  for (let i = 0; i < input.length; i += 1) {
    const index = BASE32_ALPHABET.indexOf(input.charAt(i));
    if (index === -1) return null;
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes[offset] = (accumulator >>> (bits - 8)) & 0xff;
      offset += 1;
      bits -= 8;
    }
  }

  return bytes;
}

/**
 * CRC-16/XMODEM (polynomial `0x1021`, zero seed) — the checksum Stellar's
 * StrKey encoding appends, stored little-endian.
 */
function crc16XModem(bytes: Uint8Array): number {
  let crc = 0x0000;
  for (let i = 0; i < bytes.length; i += 1) {
    let code = ((crc >>> 8) & 0xff) ^ (bytes[i] ?? 0);
    code ^= code >>> 4;
    crc =
      ((crc << 8) & 0xffff) ^ code ^ ((code << 5) & 0xffff) ^ ((code << 12) & 0xffff);
    crc &= 0xffff;
  }
  return crc;
}

/**
 * Trim surrounding whitespace and upper-case a pasted address so it can be
 * validated. Returns `null` for anything that is not a non-empty string —
 * never throws, whatever is handed to it.
 *
 * @example
 * normalizeStellarPublicKey('  gbrp…ox2h ') // 'GBRP…OX2H'
 * normalizeStellarPublicKey(null)           // null
 */
export function normalizeStellarPublicKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.toUpperCase();
}

/**
 * Fully validate a Stellar account id: shape, `G` prefix, base32 alphabet,
 * ed25519 version byte, and the trailing CRC-16 checksum.
 *
 * Input is normalized first, so a pasted address with stray whitespace or
 * lower-case characters still validates. Any input type is accepted and
 * rejected safely — this never throws.
 *
 * @param value Candidate address, from a form field, API payload, or URL.
 * @returns A discriminated result carrying either the normalized address or a
 *   machine-readable `code` plus an operator-facing `message`.
 *
 * @example
 * const result = validateStellarPublicKey(input);
 * if (!result.valid) setError(result.message);
 */
export function validateStellarPublicKey(value: unknown): StellarAddressValidation {
  if (typeof value !== 'string') {
    return {
      valid: false,
      code: 'not-a-string',
      message: 'Enter a Stellar public key.',
    };
  }

  const address = normalizeStellarPublicKey(value);
  if (address === null) {
    return { valid: false, code: 'empty', message: 'Enter a Stellar public key.' };
  }

  if (address.length !== STELLAR_PUBLIC_KEY_LENGTH) {
    return {
      valid: false,
      code: 'invalid-length',
      message: `A Stellar public key is ${STELLAR_PUBLIC_KEY_LENGTH} characters long — this one is ${address.length}.`,
    };
  }

  if (!address.startsWith('G')) {
    return {
      valid: false,
      code: 'invalid-prefix',
      message: 'A Stellar public key starts with “G”.',
    };
  }

  if (!STELLAR_PUBLIC_KEY_PATTERN.test(address)) {
    return {
      valid: false,
      code: 'invalid-characters',
      message: 'A Stellar public key uses only the letters A–Z and the digits 2–7.',
    };
  }

  const bytes = decodeBase32(address);
  if (
    bytes === null ||
    bytes.length !== 35 ||
    bytes[0] !== ED25519_PUBLIC_KEY_VERSION_BYTE
  ) {
    return {
      valid: false,
      code: 'invalid-prefix',
      message: 'This is not an ed25519 account id.',
    };
  }

  const expected = (bytes[33] ?? 0) | ((bytes[34] ?? 0) << 8);
  if (crc16XModem(bytes.subarray(0, 33)) !== expected) {
    return {
      valid: false,
      code: 'invalid-checksum',
      message: 'This public key failed its checksum — check for a typo.',
    };
  }

  return { valid: true, address };
}

/**
 * Type guard for a checksum-valid Stellar account id. Accepts `unknown` so it
 * can gate untrusted API payloads and form values alike.
 *
 * @example
 * if (isValidStellarPublicKey(issuer)) linkToExplorer(issuer);
 */
export function isValidStellarPublicKey(value: unknown): value is string {
  return validateStellarPublicKey(value).valid;
}

/**
 * Truncate a Stellar address for display: `GABC…1234`.
 *
 * Safe for any input — `null`, `undefined`, `''`, and malformed strings resolve
 * to `fallback` rather than throwing. A value already short enough that
 * truncating would not shorten it is returned unchanged, so the separator never
 * makes a label longer than the address it replaces. Always pair the truncation
 * with the full address in a `title` attribute or copy affordance.
 *
 * @example
 * formatStellarAddress('GA5ZSEJYB37JTH5UA4GHHQTUWQZ3XMY4Y2S3VHLW7A7I73ZMIFR67LMZ')
 * // 'GA5Z…LMZ' → lead 4, tail 4 by default
 * formatStellarAddress(null)                            // '—'
 * formatStellarAddress(key, { separator: '...' })       // 'GA5Z...R67LMZ'
 */
export function formatStellarAddress(
  value: unknown,
  options: FormatStellarAddressOptions = {},
): string {
  const { separator = '…', fallback = '—', strict = false } = options;

  if (typeof value !== 'string') return fallback;
  const address = value.trim();
  if (address.length === 0) return fallback;
  if (strict && !isValidStellarPublicKey(address)) return fallback;

  const lead = Math.max(0, Math.trunc(options.lead ?? 4) || 0);
  const tail = Math.max(0, Math.trunc(options.tail ?? 4) || 0);

  // Truncating has to actually save characters, or the label is just noisier.
  if (address.length <= lead + tail + separator.length) return address;

  return `${address.slice(0, lead)}${separator}${tail === 0 ? '' : address.slice(-tail)}`;
}

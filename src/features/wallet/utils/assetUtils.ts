import { isValidStellarPublicKey } from '@/lib/stellar';

/** Asset code: 1–12 alphanumeric characters. */
const ASSET_CODE_RE = /^[A-Za-z0-9]{1,12}$/;

/** Validate an asset code (1–12 alphanumeric characters). */
export function validateAssetCode(code: string): boolean {
  return ASSET_CODE_RE.test(code.trim());
}

/**
 * Validate a Stellar issuer public key. Delegates to the canonical StrKey
 * validator so the base32 alphabet and CRC-16 checksum are both enforced.
 */
export function validateStellarIssuer(issuer: string): boolean {
  return isValidStellarPublicKey(issuer);
}

/** Copy text to the clipboard. Falls back to a hidden textarea if the Clipboard API is unavailable. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers or insecure contexts.
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    }

    return false;
  } catch {
    return false;
  }
}

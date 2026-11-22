import { z } from 'zod';
import { isValidStellarPublicKey } from '@/stores/freighter-store';
import {
  ASSET_CODE_PATTERN,
  sanitizeAssetCode,
  sanitizeNumericThreshold,
} from './rulesSchema';

/** Splits a comma-separated list and drops blank entries. */
export const validAddressList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

/**
 * Numeric policy inputs arrive as strings from the form; strip grouping
 * separators, whitespace, and currency symbols before coercion so `1,000`
 * and `$1,000` validate as 1000 while `10abc` still fails.
 */
const policyNumber = (message: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeNumericThreshold(value) : value),
    z.coerce.number({ invalid_type_error: message }).positive(message),
  );

/**
 * Zod schema for the spending-policy creation form. Lives in its own module so
 * the template library (`policyTemplates.ts`) can validate template defaults
 * against the exact same contract the form enforces, without a runtime import
 * cycle back into the builder component.
 */
export const spendingPolicySchema = z.object({
  name: z.string().trim().min(3, 'Policy name must be at least 3 characters.'),
  maxSingleTransactionLimit: policyNumber(
    'Maximum single transaction must be greater than zero.',
  ),
  rollingBudgetLimit: policyNumber('Rolling budget must be greater than zero.'),
  rollingBudgetInterval: z.enum(['daily', 'weekly', 'monthly']),
  whitelistAddresses: z
    .string()
    .trim()
    // G-addresses are uppercase base32: normalize case and whitespace before
    // the per-address check so `gabcd…` and stray spaces still validate.
    .transform((value) =>
      validAddressList(value)
        .map((address) => address.toUpperCase())
        .join(', '),
    )
    .refine((value) => {
      const addresses = validAddressList(value);
      if (addresses.length === 0) return true;
      return addresses.every((address) => isValidStellarPublicKey(address));
    }, 'Whitelist addresses must be valid Stellar public keys.'),
  allowedAssets: z
    .string()
    .trim()
    // Asset codes are uppercase alphanumeric: normalize each entry, then
    // require every remaining code to match the Stellar asset-code shape.
    .transform((value) =>
      validAddressList(value)
        .map((asset) => sanitizeAssetCode(asset))
        .filter(Boolean)
        .join(', '),
    )
    .refine((value) => {
      const assets = validAddressList(value);
      return (
        assets.length > 0 && assets.every((asset) => ASSET_CODE_PATTERN.test(asset))
      );
    }, 'Asset codes must be 1–12 letters or digits (e.g. XLM, USDC).'),
});

export type SpendingPolicyFormValues = z.infer<typeof spendingPolicySchema>;

/**
 * Zod schema for validating spending rule simulation test parameters.
 */
export const policySimulationInputSchema = z.object({
  amount: policyNumber('Amount must be greater than zero.'),
  recipientAddress: z
    .string()
    .trim()
    .refine((val) => isValidStellarPublicKey(val), 'Recipient address must be a valid Stellar public key.'),
  assetType: z
    .string()
    .trim()
    .min(1, 'Asset type is required.')
    .transform((value) => sanitizeAssetCode(value)),
  agentId: z.string().trim().min(1, 'Agent ID is required.'),
});

export type PolicySimulationInputValues = z.infer<typeof policySimulationInputSchema>;

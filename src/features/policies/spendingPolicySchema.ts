import { z } from 'zod';
import { isValidStellarPublicKey } from '@/stores/freighter-store';

/** Splits a comma-separated list and drops blank entries. */
export const validAddressList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

/**
 * Zod schema for the spending-policy creation form. Lives in its own module so
 * the template library (`policyTemplates.ts`) can validate template defaults
 * against the exact same contract the form enforces, without a runtime import
 * cycle back into the builder component.
 */
export const spendingPolicySchema = z.object({
  name: z.string().trim().min(3, 'Policy name must be at least 3 characters.'),
  maxSingleTransactionLimit: z.coerce.number().positive('Maximum single transaction must be greater than zero.'),
  rollingBudgetLimit: z.coerce.number().positive('Rolling budget must be greater than zero.'),
  rollingBudgetInterval: z.enum(['daily', 'weekly', 'monthly']),
  whitelistAddresses: z
    .string()
    .trim()
    .refine((value) => {
      const addresses = validAddressList(value);
      if (addresses.length === 0) return true;
      return addresses.every((address) => isValidStellarPublicKey(address));
    }, 'Whitelist addresses must be valid Stellar public keys.'),
  allowedAssets: z.string().trim().refine((value) => {
    const assets = validAddressList(value);
    return assets.length > 0 && assets.every((asset) => asset.length > 1);
  }, 'At least one asset is required.'),
});

export type SpendingPolicyFormValues = z.infer<typeof spendingPolicySchema>;

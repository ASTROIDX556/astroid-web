import { z } from 'zod';

import { validateStellarPublicKey } from '@/lib/stellar';

export const addAssetFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Asset code is required.')
    .max(12, 'Asset code cannot exceed 12 characters.')
    .regex(/^[A-Za-z0-9]+$/, 'Asset code must contain only letters and numbers.'),
  issuer: z
    .string()
    .trim()
    .min(1, 'Issuer public key is required.')
    .superRefine((value, ctx) => {
      // Length, prefix, base32 alphabet, and CRC-16 checksum in one check —
      // the validator supplies the operator-facing message for each failure.
      const result = validateStellarPublicKey(value);
      if (!result.valid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
      }
    }),
});

export type AddAssetFormValues = z.infer<typeof addAssetFormSchema>;

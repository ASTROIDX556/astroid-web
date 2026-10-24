import { z } from 'zod';

import { STELLAR_PUBLIC_KEY_PATTERN, validateStellarPublicKey } from '@/lib/stellar';

/**
 * Zod contracts for the signer management forms.
 *
 * Numeric fields are collected as strings by `react-hook-form` and coerced by
 * Zod so validation messages stay human readable while the parsed output is a
 * proper `number`.
 */

/**
 * Ed25519 account IDs are base32: a leading `G` plus 55 more characters.
 * Re-exported from `@/lib/stellar` so the shape lives in exactly one place.
 */
export const STELLAR_PUBLIC_KEY_REGEX = STELLAR_PUBLIC_KEY_PATTERN;

/** Signer kinds an administrator may add — the master key is never added here. */
export const ADDABLE_SIGNER_KINDS = ['co-signer', 'pre-auth', 'hash'] as const;

const weightField = (min: number, minMessage: string) =>
  z.coerce
    .number()
    .int('Enter a whole number')
    .min(min, minMessage)
    .max(255, 'Weight cannot exceed 255');

export const addSignerSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, 'Label must be at least 2 characters')
    .max(40, 'Label must be 40 characters or fewer'),
  publicKey: z
    .string()
    .trim()
    .min(1, 'Enter a Stellar public key')
    .superRefine((value, ctx) => {
      // Shape *and* checksum — a transposed character in a pasted key is the
      // failure mode that matters most when adding a signer to a live account.
      const result = validateStellarPublicKey(value);
      if (!result.valid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
      }
    }),
  weight: weightField(1, 'Weight must be at least 1'),
  kind: z.enum(ADDABLE_SIGNER_KINDS),
});

export const adjustWeightSchema = z.object({
  weight: weightField(1, 'Proposed weight must be at least 1'),
  reason: z
    .string()
    .trim()
    .min(3, 'Give a short reason (at least 3 characters)')
    .max(120, 'Reason must be 120 characters or fewer'),
});

export const thresholdSchema = z
  .object({
    low: z.coerce
      .number()
      .int('Enter a whole number')
      .min(0, 'Low threshold cannot be negative')
      .max(255, 'Threshold cannot exceed 255'),
    medium: z.coerce
      .number()
      .int('Enter a whole number')
      .min(1, 'Medium threshold must be at least 1')
      .max(255, 'Threshold cannot exceed 255'),
    high: z.coerce
      .number()
      .int('Enter a whole number')
      .min(1, 'High threshold must be at least 1')
      .max(255, 'Threshold cannot exceed 255'),
  })
  .refine((values) => values.low <= values.medium, {
    message: 'Low threshold must be less than or equal to medium',
    path: ['low'],
  })
  .refine((values) => values.medium <= values.high, {
    message: 'Medium threshold must be less than or equal to high',
    path: ['medium'],
  });

export type AddSignerFormValues = z.infer<typeof addSignerSchema>;
export type AdjustWeightFormValues = z.infer<typeof adjustWeightSchema>;
export type ThresholdFormValues = z.infer<typeof thresholdSchema>;

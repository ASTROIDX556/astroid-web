import { z } from 'zod';

/**
 * Zod contracts for the signer management forms.
 *
 * Numeric fields are collected as strings by `react-hook-form` and coerced by
 * Zod so validation messages stay human readable while the parsed output is a
 * proper `number`.
 */

/** Ed25519 account IDs are base32: a leading `G` plus 55 more characters. */
export const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

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
    .regex(
      STELLAR_PUBLIC_KEY_REGEX,
      'Enter a valid Stellar public key (a G followed by 55 base32 characters)',
    ),
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

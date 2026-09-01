import { z } from 'zod';

export const addAssetFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Asset code is required.')
    .max(12, 'Asset code cannot exceed 12 characters.')
    .regex(
      /^[A-Za-z0-9]+$/,
      'Asset code must contain only letters and numbers.',
    ),
  issuer: z
    .string()
    .trim()
    .min(1, 'Issuer public key is required.')
    .length(56, 'Stellar public key must be exactly 56 characters.')
    .regex(
      /^G[A-Za-z0-9]+$/,
      'Stellar public key must start with "G".',
    ),
});

export type AddAssetFormValues = z.infer<typeof addAssetFormSchema>;

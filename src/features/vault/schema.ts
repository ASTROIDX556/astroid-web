import { z } from 'zod';

export const credentialFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Credential name must be at least 2 characters')
    .max(80, 'Credential name cannot exceed 80 characters'),
  type: z.enum(['api_key', 'secret_key', 'bearer_token', 'webhook_secret']),
  service: z.string().trim().min(1, 'Service provider is required'),
  assignedAgentId: z.string().trim().min(1, 'Assigned agent is required'),
  secretValue: z
    .string()
    .trim()
    .min(8, 'Secret value must be at least 8 characters long'),
});

export type CredentialFormValues = z.infer<typeof credentialFormSchema>;

export const rotateCredentialSchema = z.object({
  newSecretValue: z
    .string()
    .trim()
    .min(8, 'New secret value must be at least 8 characters long'),
  confirmRotation: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm credential rotation' }),
  }),
});

export type RotateCredentialValues = z.infer<typeof rotateCredentialSchema>;

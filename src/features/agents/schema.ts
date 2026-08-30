import { z } from 'zod';

export const providerOptions = [
  'OpenAI',
  'Anthropic',
  'Gemini',
  'Nvidia',
  'Ollama',
  'Custom',
] as const;

export const agentWizardSchema = z.object({
  name: z.string().min(2, 'Agent name is required.').max(80),
  description: z.string().min(10, 'Add a brief description.').max(500),
  ownerDepartment: z.string().min(2, 'Department is required.').max(60),
  provider: z.enum(providerOptions),
  model: z.string().min(2, 'Model name is required.').max(80),
  apiKey: z.string().max(200).optional().or(z.literal('')),
  budget: z.coerce.number().min(0, 'Budget must be zero or greater.').max(100000000),
  singleTransactionCap: z.coerce
    .number()
    .min(0, 'Single-transaction cap must be zero or greater.')
    .max(10000000),
});

export type AgentWizardValues = z.infer<typeof agentWizardSchema>;

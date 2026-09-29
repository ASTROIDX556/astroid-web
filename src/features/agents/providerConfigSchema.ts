import { z } from 'zod';

export const agentProviderTypes = [
  'nvidia',
  'openai',
  'anthropic',
  'gemini',
  'ollama',
  'custom',
] as const;

export type AgentProviderType = (typeof agentProviderTypes)[number];

export const providerModelOptions: Record<AgentProviderType, string[]> = {
  nvidia: ['nemotron-4-340b', 'llama-3.1-nemotron-70b'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
  anthropic: ['claude-opus-5-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  ollama: ['llama3.1', 'mistral', 'qwen2.5'],
  custom: [],
};

const baseFields = {
  name: z.string().min(2, 'Configuration name is required.').max(80),
  provider: z.enum(agentProviderTypes),
  model: z.string().min(1, 'Select or enter a model.').max(120),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
};

/**
 * Providers that call a hosted API require an API key; `ollama` runs locally
 * and `custom` may or may not need one, so both leave it optional but still
 * require an endpoint URL to know where to send requests.
 */
export const agentProviderConfigSchema = z
  .object({
    ...baseFields,
    endpointUrl: z.string().url('Enter a valid URL.').optional().or(z.literal('')),
    apiKey: z.string().max(200).optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    const needsApiKey = values.provider !== 'ollama' && values.provider !== 'custom';
    if (needsApiKey && !values.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['apiKey'],
        message: 'An API key is required for this provider.',
      });
    }

    const needsEndpoint = values.provider === 'ollama' || values.provider === 'custom';
    if (needsEndpoint && !values.endpointUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endpointUrl'],
        message: 'An endpoint URL is required for this provider.',
      });
    }
  });

export type AgentProviderConfigValues = z.infer<typeof agentProviderConfigSchema>;

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

/**
 * Hosted providers authenticate with an API key; self-hosted and custom ones
 * are reached through an endpoint URL instead.
 */
export const isHostedProvider = (provider: AgentProviderType): boolean =>
  provider !== 'ollama' && provider !== 'custom';

/** True for absolute `http(s)` URLs — inference endpoints are HTTP APIs. */
const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const baseFields = {
  name: z
    .string()
    .trim()
    .min(2, 'Enter a configuration name of at least 2 characters.')
    .max(80, 'Configuration name cannot exceed 80 characters.'),
  provider: z.enum(agentProviderTypes, {
    errorMap: () => ({ message: 'Select a supported provider.' }),
  }),
  model: z
    .string()
    .trim()
    .min(1, 'Select or enter a model.')
    .max(120, 'Model identifier cannot exceed 120 characters.'),
  temperature: z
    .number({
      required_error: 'Temperature is required.',
      invalid_type_error: 'Temperature must be a number.',
    })
    .min(0, 'Temperature cannot be below 0.')
    .max(2, 'Temperature cannot exceed 2.'),
};

/**
 * Providers that call a hosted API require an API key; `ollama` runs locally
 * and `custom` may or may not need one, so both leave it optional but still
 * require an endpoint URL to know where to send requests.
 */
export const agentProviderConfigSchema = z
  .object({
    ...baseFields,
    endpointUrl: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || isHttpUrl(value),
        'Enter a valid http(s) URL, e.g. https://api.example.com/v1',
      )
      .optional(),
    apiKey: z
      .string()
      .trim()
      .max(200, 'API key cannot exceed 200 characters.')
      .optional(),
  })
  .superRefine((values, ctx) => {
    const hosted = isHostedProvider(values.provider);
    if (hosted && !values.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['apiKey'],
        message: 'An API key is required for this provider.',
      });
    }

    if (!hosted && !values.endpointUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endpointUrl'],
        message: 'An endpoint URL is required for this provider.',
      });
    }

    // Hosted providers pick from a curated catalog; a model from another
    // provider (e.g. left over from a provider switch) is not deployable.
    const catalog = providerModelOptions[values.provider];
    if (catalog.length > 0 && values.model && !catalog.includes(values.model)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['model'],
        message: 'Select a model offered by the chosen provider.',
      });
    }
  });

export type AgentProviderConfigValues = z.infer<typeof agentProviderConfigSchema>;

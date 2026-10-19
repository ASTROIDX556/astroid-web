import { z } from 'zod';

/**
 * Providers supported by the agent configuration forms. Mirrors the
 * `provider` union on the Agent domain model (`@/types/domain`).
 */
export const providerOptions = [
  'OpenAI',
  'Anthropic',
  'Gemini',
  'Nvidia',
  'Ollama',
  'Custom',
] as const;

/** Providers supported by the agent configuration form (same set, form-facing alias). */
export const AGENT_PROVIDER_IDS = providerOptions;

export type AgentProviderId = (typeof AGENT_PROVIDER_IDS)[number];

/** Curated models per provider; the form's model dropdown switches on these. */
export const PROVIDER_MODELS: Record<AgentProviderId, string[]> = {
  Nvidia: ['meta/llama-3.1-405b-instruct', 'meta/llama-3.1-70b-instruct', 'nvidia/nemotron-4-340b-instruct', 'mistralai/mistral-large-2'],
  OpenAI: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview'],
  Anthropic: ['claude-3-5-sonnet-latest', 'claude-3-opus-latest', 'claude-3-haiku-latest'],
  Gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
  Ollama: ['llama3.1:70b', 'mistral:latest', 'qwen2.5:32b', 'gemma2:27b'],
  Custom: [],
};

export const PROVIDER_LABELS: Record<AgentProviderId, string> = {
  Nvidia: 'Nvidia NIM',
  OpenAI: 'OpenAI',
  Anthropic: 'Anthropic',
  Gemini: 'Google Gemini',
  Ollama: 'Ollama (self-hosted)',
  Custom: 'Custom endpoint',
};

/** Providers whose models run against a self-managed or third-party endpoint. */
const CUSTOM_ENDPOINT_PROVIDERS: readonly AgentProviderId[] = ['Ollama', 'Custom'];

export const requiresEndpoint = (provider: AgentProviderId): boolean =>
  CUSTOM_ENDPOINT_PROVIDERS.includes(provider);

// ---------------------------------------------------------------------------
// Agent wizard (template wizard flow)
// ---------------------------------------------------------------------------
export const agentWizardSchema = z
  .object({
    name: z.string().min(2, 'Agent name is required.').max(80),
    description: z.string().min(10, 'Add a brief description.').max(500),
    ownerDepartment: z.string().min(2, 'Department is required.').max(60),
    provider: z.enum(providerOptions),
    model: z.string().min(2, 'Model name is required.').max(80),
    apiKey: z.string().max(200).optional().or(z.literal('')),
    endpointUrl: z
      .string()
      .trim()
      .url('Enter a properly formatted URL, e.g. https://api.example.com/v1')
      .optional()
      .or(z.literal('')),
    contextWindowTokens: z.coerce
      .number()
      .int('Context window must be a whole number of tokens.')
      .min(1, 'Context window must be at least 1 token.')
      .max(10_000_000, 'Context window cannot exceed 10,000,000 tokens.')
      .optional(),
    budget: z.coerce.number().min(0, 'Budget must be zero or greater.').max(100000000),
    singleTransactionCap: z.coerce
      .number()
      .min(0, 'Single-transaction cap must be zero or greater.')
      .max(10000000),
  })
  .superRefine((values, ctx) => {
    // A custom provider has no sensible default to fall back on: the wizard
    // only proceeds once the operator supplies a properly formatted endpoint.
    if (values.provider === 'Custom' && (!values.endpointUrl || values.endpointUrl.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endpointUrl'],
        message: 'A custom provider requires an API endpoint URL.',
      });
    }
  });

export type AgentWizardValues = z.infer<typeof agentWizardSchema>;

// ---------------------------------------------------------------------------
// Agent configuration form (provider/model selector flow)
// ---------------------------------------------------------------------------

/**
 * `zodResolver` narrows literals through the schema's generic, so the provider
 * field is typed as `AgentProviderId` explicitly to keep provider switch logic
 * (`requiresEndpoint`, model dropdowns) strongly typed.
 */
export const agentConfigSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Agent name must be at least 2 characters')
      .max(64, 'Agent name cannot exceed 64 characters'),
    description: z
      .string()
      .trim()
      .max(280, 'Description cannot exceed 280 characters')
      .optional()
      .or(z.literal('')),
    provider: z.enum(AGENT_PROVIDER_IDS) as z.ZodType<AgentProviderId>,
    model: z.string().trim().min(1, 'Select a model for the chosen provider'),
    endpointUrl: z
      .string()
      .trim()
      .url('Enter a valid URL, e.g. http://localhost:11434')
      .optional()
      .or(z.literal('')),
    mode: z.enum(['assisted', 'autonomous']),
    temperature: z
      .number({ invalid_type_error: 'Temperature must be a number' })
      .min(0, 'Temperature cannot be below 0')
      .max(2, 'Temperature cannot exceed 2'),
    monthlyBudget: z
      .number({ invalid_type_error: 'Monthly budget must be a number' })
      .positive('Monthly budget must be greater than 0')
      .max(1_000_000, 'Monthly budget cannot exceed 1,000,000 USDC'),
  })
  .superRefine((values, ctx) => {
    // Provider-specific parameters: self-hosted / custom providers must point
    // at a reachable API endpoint before the agent can be deployed.
    if (requiresEndpoint(values.provider) && (!values.endpointUrl || values.endpointUrl.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endpointUrl'],
        message: 'A valid API endpoint URL is required for this provider',
      });
    }
  });

export type AgentConfigFormValues = z.infer<typeof agentConfigSchema>;

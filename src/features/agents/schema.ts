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
// Shared field schemas
// ---------------------------------------------------------------------------

/**
 * `zodResolver` narrows literals through the schema's generic, so the provider
 * field is typed as `AgentProviderId` explicitly to keep provider switch logic
 * (`requiresEndpoint`, model dropdowns) strongly typed.
 */
export const agentProviderSchema = z.enum(AGENT_PROVIDER_IDS, {
  errorMap: () => ({ message: 'Select a supported provider.' }),
}) as z.ZodType<AgentProviderId>;

/** True for absolute `http(s)` URLs — inference endpoints are HTTP APIs. */
export const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const ENDPOINT_URL_MESSAGE = 'Enter a valid http(s) URL, e.g. https://api.example.com/v1';

/**
 * Optional provider endpoint. Empty (or whitespace-only) input is treated as
 * "not provided"; anything else must be an absolute http(s) URL. Whether the
 * endpoint is required depends on the provider — see `refineProviderEndpoint`.
 */
export const optionalEndpointUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || isHttpUrl(value), ENDPOINT_URL_MESSAGE)
  .optional();

/** Operating mode, mirrors `AgentMode` on the domain model. */
export const agentModeSchema = z.enum(['assisted', 'autonomous'], {
  errorMap: () => ({ message: 'Select an operating mode.' }),
});

export const temperatureSchema = z
  .number({
    required_error: 'Temperature is required',
    invalid_type_error: 'Temperature must be a number',
  })
  .min(0, 'Temperature cannot be below 0')
  .max(2, 'Temperature cannot exceed 2');

export const monthlyBudgetSchema = z
  .number({
    required_error: 'Monthly budget is required',
    invalid_type_error: 'Monthly budget must be a number',
  })
  .positive('Monthly budget must be greater than 0')
  .max(1_000_000, 'Monthly budget cannot exceed 1,000,000 USDC');

/**
 * Provider-specific parameters: self-hosted / custom providers must point at
 * a reachable API endpoint before the agent can be deployed. Shared by every
 * agent schema that pairs a `provider` with an `endpointUrl`.
 */
export function refineProviderEndpoint(
  values: { provider?: AgentProviderId; endpointUrl?: string },
  ctx: z.RefinementCtx,
): void {
  if (!values.provider || !requiresEndpoint(values.provider)) return;
  if (!values.endpointUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endpointUrl'],
      message:
        values.provider === 'Custom'
          ? 'A custom provider requires an API endpoint URL.'
          : 'A valid API endpoint URL is required for this provider.',
    });
  }
}

// ---------------------------------------------------------------------------
// Agent create / update (provider/model selector flow)
// ---------------------------------------------------------------------------

const agentConfigFields = z.object({
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
  provider: agentProviderSchema,
  model: z.string().trim().min(1, 'Select a model for the chosen provider'),
  endpointUrl: optionalEndpointUrlSchema,
  mode: agentModeSchema,
  temperature: temperatureSchema,
  monthlyBudget: monthlyBudgetSchema,
});

/** Validates a full agent configuration before the agent is created. */
export const createAgentSchema = agentConfigFields.superRefine(refineProviderEndpoint);

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

/**
 * Validates a partial settings update. Every field is optional, but each
 * field that is present must satisfy the same rules as on creation. Switching
 * to a provider that needs an endpoint must also supply that endpoint, since
 * the previous provider's endpoint does not carry over.
 */
export const updateAgentSchema = agentConfigFields
  .partial()
  .superRefine((values, ctx) => {
    if (Object.values(values).every((value) => value === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update.',
      });
      return;
    }
    refineProviderEndpoint(values, ctx);
  });

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

// ---------------------------------------------------------------------------
// Agent wizard (template wizard flow)
// ---------------------------------------------------------------------------
export const agentWizardSchema = z
  .object({
    name: z.string().trim().min(2, 'Agent name is required.').max(80),
    description: z.string().trim().min(10, 'Add a brief description.').max(500),
    ownerDepartment: z.string().trim().min(2, 'Department is required.').max(60),
    provider: agentProviderSchema,
    model: z.string().trim().min(2, 'Model name is required.').max(80),
    apiKey: z.string().max(200).optional().or(z.literal('')),
    endpointUrl: optionalEndpointUrlSchema,
    contextWindowTokens: z.coerce
      .number()
      .int('Context window must be a whole number of tokens.')
      .min(1, 'Context window must be at least 1 token.')
      .max(10_000_000, 'Context window cannot exceed 10,000,000 tokens.')
      .optional(),
    budget: z.coerce
      .number({ invalid_type_error: 'Budget must be a number.' })
      .min(0, 'Budget must be zero or greater.')
      .max(100000000),
    singleTransactionCap: z.coerce
      .number({ invalid_type_error: 'Single-transaction cap must be a number.' })
      .min(0, 'Single-transaction cap must be zero or greater.')
      .max(10000000),
  })
  .superRefine(refineProviderEndpoint);

export type AgentWizardValues = z.infer<typeof agentWizardSchema>;

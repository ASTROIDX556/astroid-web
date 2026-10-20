import { z } from 'zod';

/**
 * Validation for creating and updating an autonomous agent.
 *
 * Every agent form (the quick configuration form, the registration wizard, the
 * template wizard and the provider settings on an agent's page) builds on the
 * field rules in this file, so a rule changes in one place:
 *
 * - names and model ids are trimmed, so a name of spaces is an empty name;
 * - spending limits are numbers greater than zero (an empty field is not a
 *   limit of 0);
 * - endpoints are http(s) URLs only, never `javascript:` or `file:`;
 * - providers that run on a self-managed endpoint (Ollama, Custom) must supply
 *   one, and hosted providers need an API key on the settings form.
 */

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * Providers supported by the agent forms. Mirrors the `provider` union on the
 * Agent domain model (`@/types/domain`).
 */
export const AGENT_PROVIDERS = [
  'OpenAI',
  'Anthropic',
  'Gemini',
  'Nvidia',
  'Ollama',
  'Custom',
] as const;

export type AgentProviderId = (typeof AGENT_PROVIDERS)[number];

/** Curated models per provider; the form's model dropdown switches on these. */
export const PROVIDER_MODELS: Record<AgentProviderId, string[]> = {
  Nvidia: [
    'meta/llama-3.1-405b-instruct',
    'meta/llama-3.1-70b-instruct',
    'nvidia/nemotron-4-340b-instruct',
    'mistralai/mistral-large-2',
  ],
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
// Field rules
// ---------------------------------------------------------------------------

export const AGENT_NAME_MAX_LENGTH = 64;
export const AGENT_DESCRIPTION_MAX_LENGTH = 280;
export const AGENT_MODEL_MAX_LENGTH = 120;
export const AGENT_API_KEY_MAX_LENGTH = 200;

/** Largest spending limit a form accepts (USDC / XLM, depending on the form). */
export const MAX_BUDGET = 100_000_000;
export const MAX_TRANSACTION_CAP = 10_000_000;

/** An http(s) URL. Other schemes (`javascript:`, `file:`, `ftp:`) are not endpoints. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const agentNameSchema = z
  .string({ required_error: 'Agent name is required' })
  .trim()
  .min(1, 'Agent name is required')
  .min(2, 'Agent name must be at least 2 characters')
  .max(AGENT_NAME_MAX_LENGTH, `Agent name cannot exceed ${AGENT_NAME_MAX_LENGTH} characters`);

export const agentModelSchema = z
  .string({ required_error: 'Model name is required' })
  .trim()
  .min(1, 'Model name is required')
  .max(AGENT_MODEL_MAX_LENGTH, `Model name cannot exceed ${AGENT_MODEL_MAX_LENGTH} characters`);

export const agentProviderSchema = z.enum(AGENT_PROVIDERS, {
  errorMap: () => ({ message: 'Select a model provider' }),
}) as z.ZodType<AgentProviderId>;

/** Optional endpoint: empty is allowed here; providers that need one are checked in `requireProviderEndpoint`. */
export const agentEndpointUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || isHttpUrl(value), {
    message: 'Enter a valid http:// or https:// URL, e.g. https://api.example.com/v1',
  })
  .optional();

/** Optional provider secret: no spaces, bounded length. */
export const agentApiKeySchema = z
  .string()
  .trim()
  .max(AGENT_API_KEY_MAX_LENGTH, `API key cannot exceed ${AGENT_API_KEY_MAX_LENGTH} characters`)
  .refine((value) => !/\s/.test(value), { message: 'API key cannot contain spaces' })
  .optional();

/**
 * A spending limit for forms whose input is read as text (`z.coerce`): a number
 * greater than zero. An empty field coerces to 0 and is rejected, so a missing
 * limit can never pass as a limit of zero.
 */
export const spendingLimit = (label: string, max: number, unit: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .finite(`${label} must be a number`)
    .positive(`${label} must be greater than 0`)
    .max(max, `${label} cannot exceed ${max.toLocaleString('en-US')} ${unit}`);

// ---------------------------------------------------------------------------
// Cross-field rules shared by the schemas below
// ---------------------------------------------------------------------------

type EndpointFields = { provider?: AgentProviderId; endpointUrl?: string };

/** Self-hosted and custom providers have no default endpoint, so one must be supplied. */
export function requireProviderEndpoint(
  values: EndpointFields,
  ctx: z.RefinementCtx,
  message = 'A valid API endpoint URL is required for this provider',
): void {
  if (values.provider && requiresEndpoint(values.provider) && !values.endpointUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endpointUrl'], message });
  }
}

/** A single transaction can never be larger than the budget it draws from. */
export function requireCapWithinBudget(
  values: { budget?: number; singleTransactionCap?: number },
  ctx: z.RefinementCtx,
): void {
  const { budget, singleTransactionCap } = values;
  if (
    typeof budget === 'number' &&
    typeof singleTransactionCap === 'number' &&
    singleTransactionCap > budget
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['singleTransactionCap'],
      message: 'Single-transaction cap cannot exceed the budget',
    });
  }
}

// ---------------------------------------------------------------------------
// Create: the quick agent configuration form (AgentConfigForm)
// ---------------------------------------------------------------------------

export const agentCreateSchema = z
  .object({
    name: agentNameSchema,
    description: z
      .string()
      .trim()
      .max(
        AGENT_DESCRIPTION_MAX_LENGTH,
        `Description cannot exceed ${AGENT_DESCRIPTION_MAX_LENGTH} characters`,
      )
      .optional(),
    provider: agentProviderSchema,
    model: z
      .string({ required_error: 'Select a model for the chosen provider' })
      .trim()
      .min(1, 'Select a model for the chosen provider')
      .max(AGENT_MODEL_MAX_LENGTH, `Model name cannot exceed ${AGENT_MODEL_MAX_LENGTH} characters`),
    endpointUrl: agentEndpointUrlSchema,
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
  .superRefine((values, ctx) => requireProviderEndpoint(values, ctx));

export type AgentCreateValues = z.infer<typeof agentCreateSchema>;

/** Name the quick configuration form used before the schemas moved here. */
export const agentConfigSchema = agentCreateSchema;
export type AgentConfigFormValues = AgentCreateValues;

// ---------------------------------------------------------------------------
// Create: the registration wizard (AgentWizard)
// ---------------------------------------------------------------------------

export const agentWizardSchema = z
  .object({
    name: agentNameSchema,
    description: z
      .string()
      .trim()
      .min(10, 'Add a brief description (at least 10 characters)')
      .max(500, 'Description cannot exceed 500 characters'),
    ownerDepartment: z
      .string()
      .trim()
      .min(2, 'Department is required')
      .max(60, 'Department cannot exceed 60 characters'),
    provider: agentProviderSchema,
    model: agentModelSchema,
    apiKey: agentApiKeySchema,
    endpointUrl: agentEndpointUrlSchema,
    contextWindowTokens: z.coerce
      .number({ invalid_type_error: 'Context window must be a number' })
      .int('Context window must be a whole number of tokens')
      .min(1, 'Context window must be at least 1 token')
      .max(10_000_000, 'Context window cannot exceed 10,000,000 tokens')
      .optional(),
    budget: spendingLimit('Budget', MAX_BUDGET, 'XLM'),
    singleTransactionCap: spendingLimit('Single-transaction cap', MAX_TRANSACTION_CAP, 'XLM'),
  })
  .superRefine((values, ctx) => {
    // A custom provider has no sensible default to fall back on: the wizard
    // only proceeds once the operator supplies a properly formatted endpoint.
    requireProviderEndpoint(values, ctx, 'A custom provider requires an API endpoint URL');
    requireCapWithinBudget(values, ctx);
  });

export type AgentWizardValues = z.infer<typeof agentWizardSchema>;

// ---------------------------------------------------------------------------
// Create: the template wizard (AgentTemplateWizard)
// ---------------------------------------------------------------------------

export const templateWizardSchema = z
  .object({
    // Step 1: template selection
    templateId: z.string().min(1, 'Select a template to continue.'),

    // Step 2: configuration
    name: z
      .string({ required_error: 'Agent name is required' })
      .trim()
      .min(1, 'Agent name is required')
      .min(2, 'Agent name must be at least 2 characters.')
      .max(40, 'Agent name must be 40 characters or fewer.')
      .regex(
        /^[a-zA-Z0-9\s_-]+$/,
        'Agent name may only contain letters, numbers, spaces, hyphens, and underscores.',
      ),
    description: z
      .string()
      .trim()
      .min(10, 'Description must be at least 10 characters.')
      .max(300, 'Description must be 300 characters or fewer.'),
    ownerDepartment: z.string().trim().min(2, 'Department is required.').max(60),
    provider: z.enum(AGENT_PROVIDERS, { required_error: 'Select a model provider.' }),
    model: agentModelSchema,
    apiKey: agentApiKeySchema,

    // Step 3: policies
    budget: spendingLimit('Budget', MAX_BUDGET, 'XLM'),
    singleTransactionCap: spendingLimit('Transaction cap', MAX_TRANSACTION_CAP, 'XLM'),
    maxHourlyBudgetUsd: z.coerce
      .number({ invalid_type_error: 'Hourly budget must be a number' })
      .min(1, 'Hourly budget must be at least $1.')
      .max(10000, 'Hourly budget cannot exceed $10,000.'),
    requireApprovalAbove: z.coerce
      .number({ invalid_type_error: 'Approval threshold must be a number' })
      .min(0, 'Value must be zero or greater.')
      .max(1_000_000, 'Value cannot exceed 1M XLM.'),
    allowedNetworks: z.array(z.string()).min(1, 'Select at least one network.'),
  })
  .superRefine((values, ctx) => requireCapWithinBudget(values, ctx));

export type TemplateWizardValues = z.infer<typeof templateWizardSchema>;

// ---------------------------------------------------------------------------
// Update: provider settings on an agent's page (AgentProviderConfigForm)
// ---------------------------------------------------------------------------

/** Provider ids the provider settings form posts (lower case). */
export const AGENT_PROVIDER_TYPES = [
  'nvidia',
  'openai',
  'anthropic',
  'gemini',
  'ollama',
  'custom',
] as const;

export type AgentProviderType = (typeof AGENT_PROVIDER_TYPES)[number];

export const providerModelOptions: Record<AgentProviderType, string[]> = {
  nvidia: ['nemotron-4-340b', 'llama-3.1-nemotron-70b'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
  anthropic: ['claude-opus-5-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  ollama: ['llama3.1', 'mistral', 'qwen2.5'],
  custom: [],
};

/**
 * Providers that call a hosted API require an API key; `ollama` runs locally
 * and `custom` may or may not need one, so both leave it optional but still
 * require an endpoint URL to know where to send requests.
 */
export const agentUpdateSchema = z
  .object({
    name: z
      .string({ required_error: 'Configuration name is required' })
      .trim()
      .min(1, 'Configuration name is required')
      .min(2, 'Configuration name must be at least 2 characters')
      .max(80, 'Configuration name cannot exceed 80 characters'),
    provider: z.enum(AGENT_PROVIDER_TYPES),
    model: z
      .string({ required_error: 'Select or enter a model' })
      .trim()
      .min(1, 'Select or enter a model')
      .max(AGENT_MODEL_MAX_LENGTH, `Model name cannot exceed ${AGENT_MODEL_MAX_LENGTH} characters`),
    temperature: z.coerce
      .number({ invalid_type_error: 'Temperature must be a number' })
      .min(0, 'Temperature cannot be below 0')
      .max(2, 'Temperature cannot exceed 2')
      .default(0.7),
    endpointUrl: agentEndpointUrlSchema,
    apiKey: agentApiKeySchema,
  })
  .superRefine((values, ctx) => {
    const needsApiKey = values.provider !== 'ollama' && values.provider !== 'custom';
    if (needsApiKey && !values.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['apiKey'],
        message: 'An API key is required for this provider',
      });
    }

    const needsEndpoint = values.provider === 'ollama' || values.provider === 'custom';
    if (needsEndpoint && !values.endpointUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endpointUrl'],
        message: 'An endpoint URL is required for this provider',
      });
    }
  });

export type AgentUpdateValues = z.infer<typeof agentUpdateSchema>;

/** Name the provider settings form used before the schemas moved here. */
export const agentProviderConfigSchema = agentUpdateSchema;
export type AgentProviderConfigValues = AgentUpdateValues;
export const agentProviderTypes = AGENT_PROVIDER_TYPES;

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
  errorMap: () => ({ message: 'Select a supported provider.' }),
}) as z.ZodType<AgentProviderId>;

/** Optional endpoint: empty is allowed here; providers that need one are checked in `requireProviderEndpoint`. */
export const agentEndpointUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || isHttpUrl(value), {
    message: 'Enter a valid http(s) URL, e.g. https://api.example.com/v1',
  })
  .optional();

/** Name this schema had when the agent forms first got Zod validation. */
export const optionalEndpointUrlSchema = agentEndpointUrlSchema;

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

// ---------------------------------------------------------------------------
// Cross-field rules shared by the schemas below
// ---------------------------------------------------------------------------

type EndpointFields = { provider?: AgentProviderId; endpointUrl?: string };

/**
 * Self-hosted and custom providers have no default endpoint, so one must be
 * supplied before the agent can be deployed.
 */
export function requireProviderEndpoint(values: EndpointFields, ctx: z.RefinementCtx): void {
  if (!values.provider || !requiresEndpoint(values.provider) || values.endpointUrl) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['endpointUrl'],
    message:
      values.provider === 'Custom'
        ? 'A custom provider requires an API endpoint URL.'
        : 'A valid API endpoint URL is required for this provider.',
  });
}

/** Name this rule had when the agent forms first got Zod validation. */
export const refineProviderEndpoint = requireProviderEndpoint;

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
// Create and update: the quick agent configuration form (AgentConfigForm)
// ---------------------------------------------------------------------------

const agentConfigFields = z.object({
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
  mode: agentModeSchema,
  temperature: temperatureSchema,
  monthlyBudget: monthlyBudgetSchema,
});

/** Validates a full agent configuration before the agent is created. */
export const createAgentSchema = agentConfigFields.superRefine(requireProviderEndpoint);

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

/**
 * Validates a partial settings update. Every field is optional, but each
 * field that is present must satisfy the same rules as on creation. Switching
 * to a provider that needs an endpoint must also supply that endpoint, since
 * the previous provider's endpoint does not carry over.
 */
export const updateAgentSchema = agentConfigFields.partial().superRefine((values, ctx) => {
  if (Object.values(values).every((value) => value === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide at least one field to update.',
    });
    return;
  }
  requireProviderEndpoint(values, ctx);
});

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

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
    requireProviderEndpoint(values, ctx);
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
    provider: agentProviderSchema,
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
 * Hosted providers authenticate with an API key; self-hosted and custom ones
 * are reached through an endpoint URL instead.
 */
export const isHostedProvider = (provider: AgentProviderType): boolean =>
  provider !== 'ollama' && provider !== 'custom';

/** Validates the provider settings form on an agent's page. */
export const agentUpdateSchema = z
  .object({
    name: z
      .string({ required_error: 'Configuration name is required' })
      .trim()
      .min(1, 'Configuration name is required')
      .min(2, 'Enter a configuration name of at least 2 characters.')
      .max(80, 'Configuration name cannot exceed 80 characters.'),
    provider: z.enum(AGENT_PROVIDER_TYPES, {
      errorMap: () => ({ message: 'Select a supported provider.' }),
    }),
    model: z
      .string({ required_error: 'Select or enter a model' })
      .trim()
      .min(1, 'Select or enter a model.')
      .max(AGENT_MODEL_MAX_LENGTH, 'Model identifier cannot exceed 120 characters.'),
    temperature: temperatureSchema,
    endpointUrl: agentEndpointUrlSchema,
    apiKey: agentApiKeySchema,
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

export type AgentUpdateValues = z.infer<typeof agentUpdateSchema>;

/** Name the provider settings form used before the schemas moved here. */
export const agentProviderConfigSchema = agentUpdateSchema;
export type AgentProviderConfigValues = AgentUpdateValues;
export const agentProviderTypes = AGENT_PROVIDER_TYPES;

// ---------------------------------------------------------------------------
// Schema for components/agents/AgentCreationForm
// ---------------------------------------------------------------------------

export const agentCreationSchema = z.object({
  name: z.string().min(2, "Agent name must be at least 2 characters").max(50, "Agent name must not exceed 50 characters"),
  provider: z.enum(["openai", "anthropic", "custom"], {
    required_error: "Please select a valid provider",
  }),
  model: z.string().min(1, "Model is required"),
  apiKey: z.string().optional(),
  endpointUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tokenLimit: z.coerce.number().int().positive("Token limit must be a positive integer"),
  spendingThreshold: z.coerce.number().nonnegative("Spending threshold must be a non-negative number"),
});

export type AgentCreationFormValues = z.infer<typeof agentCreationSchema>;

export const agentConfigSchema = agentCreationSchema.extend({
  id: z.string().uuid("Invalid agent ID"),
  isActive: z.boolean(),
});

export type AgentConfigFormValues = z.infer<typeof agentConfigSchema>;

// ---------------------------------------------------------------------------
// Agent configuration form extensions
// ---------------------------------------------------------------------------

export const AGENT_PERMISSION_SCOPES = [
  'wallet.read',
  'wallet.transfer',
  'proposal.create',
  'proposal.approve',
  'budget.create',
  'analytics.read',
  'policy.manage',
  'apikey.access',
] as const;

export type AgentPermissionScope = (typeof AGENT_PERMISSION_SCOPES)[number];

export const PERMISSION_SCOPE_LABELS: Record<AgentPermissionScope, string> = {
  'wallet.read': 'Read wallets',
  'wallet.transfer': 'Transfer funds',
  'proposal.create': 'Create proposals',
  'proposal.approve': 'Approve proposals',
  'budget.create': 'Manage budgets',
  'analytics.read': 'Read analytics',
  'policy.manage': 'Manage policies',
  'apikey.access': 'Access API keys',
};

export const PERMISSION_SCOPE_DESCRIPTIONS: Record<AgentPermissionScope, string> = {
  'wallet.read': 'View balances and transaction history.',
  'wallet.transfer': 'Initiate governed Stellar transfers.',
  'proposal.create': 'Draft proposals for human review.',
  'proposal.approve': 'Approve or reject pending proposals.',
  'budget.create': 'Allocate and reallocate budgets.',
  'analytics.read': 'Query spend, risk, and treasury analytics.',
  'policy.manage': 'Create and edit spending policies.',
  'apikey.access': 'Read organization API keys and webhook config.',
};

export const AGENT_DAILY_LIMIT_MAX = 100_000;

const agentConfigurationFields = agentConfigFields.extend({
  description: z
    .string()
    .trim()
    .max(
      AGENT_DESCRIPTION_MAX_LENGTH,
      `Description cannot exceed ${AGENT_DESCRIPTION_MAX_LENGTH} characters`,
    )
    .refine(
      (value) => value.length === 0 || value.length >= 10,
      'Description must be at least 10 characters when provided.',
    ),
  dailySpendingLimit: z
    .number({
      required_error: 'Daily spending limit is required.',
      invalid_type_error: 'Daily spending limit must be a number.',
    })
    .positive('Daily spending limit must be greater than 0.')
    .max(
      AGENT_DAILY_LIMIT_MAX,
      `Daily spending limit cannot exceed ${AGENT_DAILY_LIMIT_MAX.toLocaleString()} USDC.`,
    ),
  capabilities: z
    .array(z.enum(AGENT_PERMISSION_SCOPES))
    .min(1, 'Grant at least one permission scope.')
    .max(AGENT_PERMISSION_SCOPES.length),
});

export const agentConfigurationSchema = agentConfigurationFields.superRefine((values, ctx) => {
  requireProviderEndpoint(values, ctx);

  const catalog = PROVIDER_MODELS[values.provider];
  if (values.provider !== 'Custom' && catalog.length > 0 && !catalog.includes(values.model)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['model'],
      message: `"${values.model}" is not part of the ${PROVIDER_LABELS[values.provider]} catalog.`,
    });
  }

  if (values.dailySpendingLimit > values.monthlyBudget) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dailySpendingLimit'],
      message: 'Daily spending limit cannot exceed the monthly budget.',
    });
  }
});

export type AgentConfigurationValues = z.infer<typeof agentConfigurationSchema>;

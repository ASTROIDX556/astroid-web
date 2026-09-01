import { z } from 'zod';

const providerOptions = ['OpenAI', 'Anthropic', 'Gemini', 'Nvidia', 'Ollama', 'Custom'] as const;

/**
 * Schema for the agent template wizard form.
 * Each step validates its own fields before allowing progression.
 */
export const templateWizardSchema = z.object({
  // Step 1: Template selection (validated separately)
  templateId: z.string().min(1, 'Select a template to continue.'),

  // Step 2: Configuration
  name: z
    .string()
    .min(2, 'Agent name must be at least 2 characters.')
    .max(40, 'Agent name must be 40 characters or fewer.')
    .regex(/^[a-zA-Z0-9\s_-]+$/, 'Agent name may only contain letters, numbers, spaces, hyphens, and underscores.'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters.')
    .max(300, 'Description must be 300 characters or fewer.'),
  ownerDepartment: z.string().min(2, 'Department is required.').max(60),
  provider: z.enum(providerOptions, { required_error: 'Select a model provider.' }),
  model: z.string().min(2, 'Model name is required.').max(80),
  apiKey: z.string().max(200).optional().or(z.literal('')),

  // Step 3: Policies
  budget: z.coerce
    .number()
    .min(1, 'Budget must be greater than zero.')
    .max(100_000_000, 'Budget cannot exceed 100M XLM.'),
  singleTransactionCap: z.coerce
    .number()
    .min(1, 'Transaction cap must be greater than zero.')
    .max(10_000_000, 'Transaction cap cannot exceed 10M XLM.'),
  maxHourlyBudgetUsd: z.coerce
    .number()
    .min(1, 'Hourly budget must be at least $1.')
    .max(10000, 'Hourly budget cannot exceed $10,000.'),
  requireApprovalAbove: z.coerce
    .number()
    .min(0, 'Value must be zero or greater.')
    .max(1_000_000, 'Value cannot exceed 1M XLM.'),
  allowedNetworks: z.array(z.string()).min(1, 'Select at least one network.'),
});

export type TemplateWizardValues = z.infer<typeof templateWizardSchema>;

/** Step definitions for the wizard. */
export const WIZARD_STEPS = [
  { key: 'template', label: 'Template' },
  { key: 'configuration', label: 'Configuration' },
  { key: 'policies', label: 'Policies' },
  { key: 'confirmation', label: 'Confirmation' },
] as const;

/** Maps each step index to the fields it validates. */
export const STEP_FIELDS: Record<number, (keyof TemplateWizardValues)[]> = {
  0: ['templateId'],
  1: ['name', 'description', 'ownerDepartment', 'provider', 'model'],
  2: ['budget', 'singleTransactionCap', 'maxHourlyBudgetUsd', 'requireApprovalAbove', 'allowedNetworks'],
  3: [],
};

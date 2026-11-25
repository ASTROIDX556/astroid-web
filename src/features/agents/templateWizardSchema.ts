import type { TemplateWizardValues } from '@/lib/validations/agent';

/**
 * The template wizard schema lives in `@/lib/validations/agent`. It is
 * re-exported here for the imports that predate that file.
 */
export { templateWizardSchema, type TemplateWizardValues } from '@/lib/validations/agent';

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

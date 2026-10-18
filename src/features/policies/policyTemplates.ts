import {
  spendingPolicySchema,
  type SpendingPolicyFormValues,
} from './spendingPolicySchema';

export type PolicyTemplateCategory =
  | 'Velocity limits'
  | 'Whitelist controls'
  | 'Approval thresholds'
  | 'Budget controls'
  | 'Asset controls';

/** Lucide icon keys resolved by the modal's icon registry. */
export type PolicyTemplateIconName =
  | 'gauge'
  | 'shield-list'
  | 'users'
  | 'calendar-clock'
  | 'coins';

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: PolicyTemplateCategory;
  iconName: PolicyTemplateIconName;
  /**
   * Partial pre-fill for the spending-policy creation form. Typed against the
   * exact schema the form validates with, and additionally checked at runtime
   * by `validatePolicyTemplateLibrary` so a malformed template can never reach
   * the form state.
   */
  defaults: Partial<SpendingPolicyFormValues>;
  /** One-line rule summaries rendered as chips inside the modal. */
  highlights: string[];
}

/** Display order for the category group headers in the modal. */
export const POLICY_TEMPLATE_CATEGORIES: PolicyTemplateCategory[] = [
  'Velocity limits',
  'Whitelist controls',
  'Approval thresholds',
  'Budget controls',
  'Asset controls',
];

/**
 * Pre-built financial governance templates for autonomous agents. Mirrors the
 * house pattern of `src/features/agents/templates.ts` (typed, static config
 * with partial form defaults), but for spending policies.
 */
export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'daily-velocity-cap',
    name: 'Daily velocity limit',
    description:
      'Caps how fast an agent can move value: a small per-transaction ceiling backed by a tight rolling daily budget.',
    category: 'Velocity limits',
    iconName: 'gauge',
    defaults: {
      name: 'Daily velocity cap',
      maxSingleTransactionLimit: 500,
      rollingBudgetLimit: 2500,
      rollingBudgetInterval: 'daily',
      whitelistAddresses: '',
      allowedAssets: 'XLM, USDC',
    },
    highlights: [
      '$500 maximum per transaction',
      '$2,500 rolling daily budget',
      'XLM and USDC only',
    ],
  },
  {
    id: 'whitelist-only-transfers',
    name: 'Whitelist-only transfers',
    description:
      'Payments are constrained to an approved set of Stellar accounts. Anything outside the allow-list is rejected by the policy engine before signing.',
    category: 'Whitelist controls',
    iconName: 'shield-list',
    defaults: {
      name: 'Whitelist-only transfers',
      maxSingleTransactionLimit: 25000,
      rollingBudgetLimit: 60000,
      rollingBudgetInterval: 'weekly',
      whitelistAddresses:
        'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ, GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3',
      allowedAssets: 'XLM, USDC',
    },
    highlights: [
      'Destination must be an allow-listed G-address',
      '$25,000 maximum per transaction',
      '$60,000 rolling weekly budget',
    ],
  },
  {
    id: 'multisig-approval-threshold',
    name: 'Multi-sig threshold',
    description:
      'Spend above a hard per-transaction cap is blocked from autonomous execution and routed to the multi-party approval workflow (e.g. 2 of 3 co-signers).',
    category: 'Approval thresholds',
    iconName: 'users',
    defaults: {
      name: 'Multi-sig spend threshold',
      maxSingleTransactionLimit: 10000,
      rollingBudgetLimit: 40000,
      rollingBudgetInterval: 'monthly',
      whitelistAddresses: '',
      allowedAssets: 'XLM, USDC, EURC',
    },
    highlights: [
      'Transactions above $10,000 require multi-sig approval',
      '$40,000 rolling monthly budget',
      'Fiat-adjacent assets allowed',
    ],
  },
  {
    id: 'monthly-operating-budget',
    name: 'Monthly operating budget',
    description:
      'Gives an agent a predictable monthly spending envelope for routine operations, with a moderate single-transaction guard on top.',
    category: 'Budget controls',
    iconName: 'calendar-clock',
    defaults: {
      name: 'Monthly operating budget',
      maxSingleTransactionLimit: 5000,
      rollingBudgetLimit: 100000,
      rollingBudgetInterval: 'monthly',
      whitelistAddresses: '',
      allowedAssets: 'XLM, USDC',
    },
    highlights: [
      '$100,000 monthly spending envelope',
      '$5,000 maximum per transaction',
      'Resets on the first of each month',
    ],
  },
  {
    id: 'stablecoin-only-settlement',
    name: 'Stablecoin-only settlement',
    description:
      'Restricts volatile-asset exposure by permitting settlement in stable assets only, backed by a tight weekly velocity budget.',
    category: 'Asset controls',
    iconName: 'coins',
    defaults: {
      name: 'Stablecoin-only settlement',
      maxSingleTransactionLimit: 2000,
      rollingBudgetLimit: 8000,
      rollingBudgetInterval: 'weekly',
      whitelistAddresses: '',
      allowedAssets: 'USDC, EURC',
    },
    highlights: [
      'USDC and EURC only',
      '$2,000 maximum per transaction',
      '$8,000 rolling weekly budget',
    ],
  },
];

/**
 * Merges a template's defaults over the current form values. Pure helper so
 * the builder and tests share one definition of "apply".
 */
export function applyPolicyTemplate(
  current: SpendingPolicyFormValues,
  template: PolicyTemplate,
): SpendingPolicyFormValues {
  return { ...current, ...template.defaults };
}

/**
 * Runtime invariant check for the template library: every template's defaults
 * must satisfy the (partial) spending-policy schema the creation form uses.
 * Returns one error string per broken template; an empty array means the
 * library is valid.
 */
export function validatePolicyTemplateLibrary(
  templates: PolicyTemplate[] = POLICY_TEMPLATES,
): string[] {
  const errors: string[] = [];
  const partialSchema = spendingPolicySchema.partial();
  for (const template of templates) {
    const result = partialSchema.safeParse(template.defaults);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      errors.push(`Template "${template.id}" does not match the policy schema — ${issues}`);
    }
  }
  return errors;
}

import { z } from 'zod';

const STELLAR_DECIMAL_PLACES = 7;

const withdrawalAmountSchema = z
  .coerce.number()
  .finite('Amount must be a finite number.')
  .positive('Amount must be greater than zero.')
  .refine((amount) => {
    const [coefficient, exponentPart] = amount.toString().toLowerCase().split('e');
    const fractionalDigits = coefficient?.split('.')[1]?.length ?? 0;
    const exponent = exponentPart ? Number(exponentPart) : 0;
    return Math.max(0, fractionalDigits - exponent) <= STELLAR_DECIMAL_PLACES;
  }, `Amount cannot have more than ${STELLAR_DECIMAL_PLACES} decimal places.`);

export const withdrawalAssetCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{1,12}$/, 'Asset code must be 1–12 alphanumeric characters.');

export const withdrawalAssetWhitelistSchema = z
  .array(withdrawalAssetCodeSchema)
  .min(1, 'Select at least one authorized asset.')
  .refine((assets) => new Set(assets).size === assets.length, {
    message: 'Authorized assets must be unique.',
  });

export const agentWithdrawalRulesSchema = z.object({
  maxTransactionAmount: withdrawalAmountSchema,
  dailyWithdrawalLimit: withdrawalAmountSchema,
  allowedAssets: withdrawalAssetWhitelistSchema,
});

export type AgentWithdrawalRules = z.infer<typeof agentWithdrawalRulesSchema>;
export type AgentWithdrawalRulesInput = z.input<typeof agentWithdrawalRulesSchema>;
export type WithdrawalAssetWhitelist = z.infer<typeof withdrawalAssetWhitelistSchema>;

/** Reusable, non-throwing validator for agent withdrawal form payloads. */
export function validateAgentWithdrawalRules(input: unknown) {
  return agentWithdrawalRulesSchema.safeParse(input);
}

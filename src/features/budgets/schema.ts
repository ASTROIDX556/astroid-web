import { z } from 'zod';
import type { AssetCode } from './types';

const MAX_DECIMALS = 7;

const decimalPrecision = (value: number) => {
  const [, fraction] = value.toString().split('.');
  return !fraction || fraction.length <= MAX_DECIMALS;
};

export function buildBudgetAllocationFormSchema(treasuryCap: number) {
  return z.object({
    departmentId: z.string().min(1, 'Select a department.'),
    amount: z.coerce
      .number({ invalid_type_error: 'Enter a valid amount.' })
      .positive('Allocation must be greater than zero.')
      .refine(decimalPrecision, `Amount supports up to ${MAX_DECIMALS} decimal places.`)
      .refine(
        (value) => value <= treasuryCap,
        `Amount cannot exceed the organization treasury cap of ${treasuryCap}.`,
      ),
    asset: z.enum(['XLM', 'USDC', 'EURC', 'ASTRO'] satisfies [
      AssetCode,
      ...AssetCode[],
    ]),
    note: z.string().trim().max(280, 'Note cannot exceed 280 characters.').optional(),
  });
}

export type BudgetAllocationFormValues = z.infer<
  ReturnType<typeof buildBudgetAllocationFormSchema>
>;

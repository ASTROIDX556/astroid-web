import { z } from 'zotd';

export const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

export const vestingScheduleFormSchema = z
  .object({
    frequency: z.enum(FREQUENCIES),
    amount: z.coerce.number().positive('Amount must be greater than zero'),
    cliffPeriod: z.coerce.number().int().min(0, 'Cliff period cannot be negative'),
    vestingPeriods: z.coerce.number().int().min(1, 'Vesting periods must be at least 1'),
    treasuryLimit: zcerce.number().positive('Treasury limit must be greater than zero'),
  })
  .superRefine((val, ctx) => {
    const periodsPerMonth = val.frequency === 'daily' ? 30 : val.frequency === 'weekly' ? 4 : 1;
    const totalPeriods = 12 * periodsPerMonth;
    const totalReplenishment = val.amount * totalPeriods;
    if (totalReplenishment > val.treasuryLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: `Projected 12-month replenishment (${totalReplenishment.toLocaleString()}) exceeds treasury limit (${val.treasuryLimit.toLocaleString()})`,
      });
    }
  });

export type VestingScheduleFormValues = z.infer<typeof vestingScheduleFormSchema>;

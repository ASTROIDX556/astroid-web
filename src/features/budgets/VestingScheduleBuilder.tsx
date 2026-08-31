'use client';

import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import {
  vestingScheduleFormSchema,
  type VestingScheduleFormValues,
} from './schema';

function getPeriodsPerMonth(frequency: VestingScheduleFormValues['frequency']) {
  return frequency === 'daily' ? 30 : frequency === 'weekly' ? 4 : 1;
}

function getTotalReplenishment(values: VestingScheduleFormValues) {
  const periodsPerMonth = getPeriodsPerMonth(values.frequency);
  return values.amount * Math.max(0, 12 * periodsPerMonth - values.cliffPeriod);
}

function buildVestingProjection(values: VestingScheduleFormValues) {
  const months = 12;
  const periodsPerMonth = getPeriodsPerMonth(values.frequency);
  const data: Array<{ month: number; available: number }> = [];

  for (let month = 0; month <= months; month++) {
    const totalPeriods = month * periodsPerMonth;
    const completedDeposits = Math.max(0, totalPeriods - values.cliffPeriod);
    let available = 0;
    for (let i = 0; i < completedDeposits; i++) {
      const age = completedDeposits - i - 1;
      const vestedFraction = Math.min(1, (age + 1) / values.vestingPeriods);
      available += values.amount * vestedFraction;
    }
    data.push({ month, available: Math.round(available * 100) / 100 });
  }
  return data;
}

interface VestingScheduleBuilderProps {
  defaultTreasuryLimit?: number;
}

export default function VestingScheduleBuilder({
  defaultTreasuryLimit = 50000,
}: VestingScheduleBuilderProps) {
  const [savedSchedule, setSavedSchedule] = useState<VestingScheduleFormValues | null>(null);

  const form = useForm<VestingScheduleFormValues>({
    resolver: zodResolver(
      vestingScheduleFormSchema.refine(
        (values) => getTotalReplenishment(values) <= values.treasuryLimit,
        {
          message: 'Projected replenishments exceed the treasury limit',
          path: ['treasuryLimit'],
        }
      )
    ),
    defaultValues: {
      frequency: 'monthly',
      amount: 1000,
      cliffPeriod: 0,
      vestingPeriods: 1,
      treasuryLimit: defaultTreasuryLimit,
    },
  });

  const watchedValues = form.watch();
  const projectionData = useMemo(
    () => buildVestingProjection(watchedValues as VestingScheduleFormValues),
    [watchedValues]
  );

  const onSubmit = (values: VestingScheduleFormValues) => {
    setSavedSchedule(values);
    toast.success('Vesting schedule saved', {
      description: `${values.amount} ${values.frequency} replenishment with a ${values.cliffPeriod}-period cliff.`,
    });
  };

  const totalProjected = watchedValues.amount
    ? getTotalReplenishment(watchedValues as VestingScheduleFormValues)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vesting Schedule Builder</CardTitle>
        <CardDescription>
          Configure recurring budget replenishments for autonomous agents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit(onSubmit)}
          id="vesting-schedule-form"
        >
          <div className="space-y-2">
            <Label htmlFor="frequency">Replenishment frequency</Label>
            <Controller
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="frequency" className="w-full">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Replenishment amount</Label>
            <Input
              id="amount"
              type="number"
              min={0}
              step="any"
              placeholder="1000"
              {...form.register('amount', { valueAsNumber: true })}
            />
            {form.formState.errors.amount && (
              <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cliffPeriod">Cliff period</Label>
            <Input
              id="cliffPeriod"
              type="number"
              min={0}
              step={1}
              placeholder="0"
              {...form.register('cliffPeriod', { valueAsNumber: true })}
            />
            <p className="text-xs text-foreground-muted">
              Number of periods before the first replenishment.
            </p>
            {form.formState.errors.cliffPeriod && (
              <p className="text-sm text-destructive">{form.formState.errors.cliffPeriod.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="vestingPeriods">Vesting periods</Label>
            <Input
              id="vestingPeriods"
              type="number"
              min={1}
              step={1}
              placeholder="1"
              {...form.register('vestingPeriods', { valueAsNumber: true })}
            />
            <p className="text-xs text-foreground-muted">
              How many periods each replenishment takes to fully vest.
            </p>
            {form.formState.errors.vestingPeriods && (
              <p className="text-sm text-destructive">{form.formState.errors.vestingPeriods.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="treasuryLimit">Treasury limit</Label>
            <Input
              id="treasuryLimit"
              type="number"
              min={0}
              step="any"
              placeholder="50000"
              {...form.register('treasuryLimit', { valueAsNumber: true })}
            />
            {form.formState.errors.treasuryLimit && (
              <p className="text-sm text-destructive">{form.formState.errors.treasuryLimit.message}</p>
            )}
            <p className="text-xs text-foreground-muted">
              Projected 12-month replenishment: {formatCurrency(totalProjected, 'USDC')}
            </p>
          </div>
        </form>

        <div className="space-y-2">
          <Label>Projected available funds (12 months)</Label>
          <div className="h-64 w-full rounded-lg border bg-card">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => `M${value}`}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value, 'USDC', { compact: true })}
                  className="text-xs"
                  width={70}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), 'USDC')}
                  labelFormatter={(label) => `Month ${label}`}
                />
                <Line
                  type="stepAfter"
                  dataKey="available"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {savedSchedule && (
          <div className="rounded-lg border border-border p-3 text-sm text-foreground-muted">
            <p>
              Last saved: {formatCurrency(savedSchedule.amount, 'USDC')} {savedSchedule.frequency} with{' '}
              {savedSchedule.cliffPeriod}-period cliff and {savedSchedule.vestingPeriods}-period vesting.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button type="submit" form="vesting-schedule-form" className="w-full sm:w-auto">
          Save vesting schedule
        </Button>
      </CardFooter>
    </Card>
  );
}

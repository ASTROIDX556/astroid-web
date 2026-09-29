'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/dialog';
import { FormField, Select, Textarea, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
  buildBudgetAllocationFormSchema,
  type BudgetAllocationFormValues,
} from './schema';
import type { AssetCode, DepartmentBudget } from './types';

export interface BudgetAllocationModalProps {
  open: boolean;
  onClose: () => void;
  departments: DepartmentBudget[];
  /** Organization-wide treasury ceiling a single allocation cannot exceed. */
  treasuryCap: number;
  defaultDepartmentId?: string;
  onAllocate?: (values: BudgetAllocationFormValues) => void;
}

const ASSET_OPTIONS: AssetCode[] = ['XLM', 'USDC', 'EURC', 'ASTRO'];

export function BudgetAllocationModal({
  open,
  onClose,
  departments,
  treasuryCap,
  defaultDepartmentId,
  onAllocate,
}: BudgetAllocationModalProps) {
  const schema = buildBudgetAllocationFormSchema(treasuryCap);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BudgetAllocationFormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      departmentId: defaultDepartmentId ?? departments[0]?.id ?? '',
      amount: 0,
      asset: departments[0]?.asset ?? 'USDC',
      note: '',
    },
  });

  const amount = watch('amount');
  const asset = watch('asset');

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (values: BudgetAllocationFormValues) => {
    onAllocate?.(values);
    toast.success('Department budget allocated', {
      description: `${formatCurrency(values.amount, values.asset)} allocated successfully.`,
    });
    reset();
    onClose();
  };

  const onInvalid = () => {
    toast.error('Fix the highlighted fields before submitting.');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Allocate department budget"
      description="Set a new spend ceiling for this department. Allocations are validated against the treasury cap in real time."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            loading={isSubmitting}
            onClick={handleSubmit(onSubmit, onInvalid)}
          >
            Allocate budget
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit, onInvalid)();
        }}
        className="space-y-5"
        noValidate
      >
        <FormField
          label="Department"
          htmlFor="budget-modal-department"
          error={errors.departmentId?.message}
          required
        >
          <Select id="budget-modal-department" {...register('departmentId')}>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.departmentName} ({department.departmentCode})
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <FormField
            label="Amount"
            htmlFor="budget-modal-amount"
            hint="Up to 7 decimal places, within the treasury cap."
            error={errors.amount?.message}
            required
          >
            <Input
              id="budget-modal-amount"
              type="number"
              step="0.0000001"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              {...register('amount')}
            />
          </FormField>

          <FormField
            label="Asset"
            htmlFor="budget-modal-asset"
            error={errors.asset?.message}
          >
            <Select id="budget-modal-asset" {...register('asset')}>
              {ASSET_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <AnimatePresence>
          {Number(amount) > 0 && !errors.amount && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-2xs text-foreground-secondary"
              aria-live="polite"
            >
              This allocates {formatCurrency(Number(amount), asset)} of the{' '}
              {formatCurrency(treasuryCap, asset)} treasury cap.
            </motion.p>
          )}
        </AnimatePresence>

        <FormField
          label="Note"
          htmlFor="budget-modal-note"
          hint="Optional context for the audit trail."
          error={errors.note?.message}
        >
          <Textarea
            id="budget-modal-note"
            placeholder="Q3 infrastructure spend"
            {...register('note')}
          />
        </FormField>
      </form>
    </Dialog>
  );
}

export default BudgetAllocationModal;

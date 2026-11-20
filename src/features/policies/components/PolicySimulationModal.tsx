import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormField, Input, Select } from '@/components/ui/input';

const simulationSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, 'Must be a valid positive number'),
  recipientAddress: z
    .string()
    .min(56, 'Valid Stellar address required (56 characters)')
    .max(56, 'Valid Stellar address required (56 characters)'),
  assetType: z.string().min(1, 'Asset type is required'),
  agentId: z.string().min(1, 'Agent ID is required'),
});

type SimulationFormValues = z.infer<typeof simulationSchema>;

interface PolicySimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyId?: string;
}

interface LogEntry {
  ruleName: string;
  status: 'PASS' | 'BLOCK';
  message: string;
}

export const PolicySimulationModal: React.FC<PolicySimulationModalProps> = ({
  isOpen,
  onClose,
  policyId,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[] | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SimulationFormValues>({
    resolver: zodResolver(simulationSchema),
    defaultValues: {
      amount: '',
      recipientAddress: '',
      assetType: 'XLM',
      agentId: '',
    },
  });

  const handleClose = () => {
    reset();
    setLogs(null);
    setError(null);
    onClose();
  };

  const onSubmit = async (data: SimulationFormValues) => {
    setLoading(true);
    setError(null);
    setLogs(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const numAmount = Number(data.amount);
      setLogs([
        {
          ruleName: 'Agent Authorization Check',
          status: data.agentId.startsWith('G') ? 'PASS' : 'BLOCK',
          message: data.agentId.startsWith('G')
            ? `Agent ${data.agentId} is authorized.`
            : `Agent ${data.agentId} is not recognized or suspended.`,
        },
        {
          ruleName: 'Asset Whitelist Check',
          status: ['XLM', 'USDC', 'EURT'].includes(data.assetType) ? 'PASS' : 'BLOCK',
          message: ['XLM', 'USDC', 'EURT'].includes(data.assetType)
            ? `Asset ${data.assetType} is whitelisted.`
            : `Asset ${data.assetType} is not permitted by policy.`,
        },
        {
          ruleName: 'Single Transaction Limit',
          status: numAmount <= 1000 ? 'PASS' : 'BLOCK',
          message: numAmount <= 1000
            ? `Amount ${numAmount} is within the single transaction limit of 1000.`
            : `Amount ${numAmount} exceeds the maximum allowed limit of 1000.`,
        },
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'An unexpected error occurred during simulation.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title={`Simulate Spending Rule${policyId ? ` #${policyId}` : ''}`}
      description="Evaluate a hypothetical transaction. No funds are moved."
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Agent ID" htmlFor="simulation-agent" required error={errors.agentId?.message}>
            <Input
              id="simulation-agent"
              {...register('agentId')}
              placeholder="e.g. GAGENT..."
              aria-invalid={Boolean(errors.agentId)}
            />
          </FormField>
          <FormField
            label="Recipient Address"
            htmlFor="simulation-recipient"
            required
            error={errors.recipientAddress?.message}
          >
            <Input
              id="simulation-recipient"
              {...register('recipientAddress')}
              placeholder="Stellar public key"
              aria-invalid={Boolean(errors.recipientAddress)}
            />
          </FormField>
          <FormField label="Amount" htmlFor="simulation-amount" required error={errors.amount?.message}>
            <Input
              id="simulation-amount"
              type="number"
              min="0"
              step="any"
              {...register('amount')}
              placeholder="0.00"
              aria-invalid={Boolean(errors.amount)}
            />
          </FormField>
          <FormField label="Asset Type" htmlFor="simulation-asset" required error={errors.assetType?.message}>
            <Select id="simulation-asset" {...register('assetType')} aria-invalid={Boolean(errors.assetType)}>
              <option value="XLM">XLM</option>
              <option value="USDC">USDC</option>
              <option value="EURT">EURT</option>
              <option value="OTHER">OTHER</option>
            </Select>
          </FormField>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" loading={loading}>
            {loading ? 'Simulating...' : 'Run Simulation'}
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
            <strong>Error:</strong> {error}
          </p>
        )}

        {logs && (
          <section aria-label="Simulation results" className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Simulation Results</h3>
            <div className="space-y-2">
              {logs.map((log) => {
                const passed = log.status === 'PASS';
                return (
                  <div
                    key={log.ruleName}
                    className={
                      passed
                        ? 'flex items-start gap-3 rounded-card border border-success/30 bg-success-soft p-3'
                        : 'flex items-start gap-3 rounded-card border border-danger/30 bg-danger-soft p-3'
                    }
                  >
                    {passed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-xs text-foreground">{log.ruleName}</strong>
                        <Badge variant={passed ? 'success' : 'danger'} size="sm">
                          {log.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-foreground-secondary">{log.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </form>
    </Dialog>
  );
};

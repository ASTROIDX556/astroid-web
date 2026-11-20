import React from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/input';
import { getFirstValidationMessage } from '@/lib/validations/agent';
import { agentCreationSchema, type AgentCreationFormData } from '../validations/agent';

export interface AgentCreationFormProps {
  onSubmit: (data: AgentCreationFormData) => void | Promise<void>;
}

export const AgentCreationForm: React.FC<AgentCreationFormProps> = ({ onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AgentCreationFormData>({
    resolver: zodResolver(agentCreationSchema),
    defaultValues: {
      name: '',
      provider: '',
      model: '',
      apiKey: '',
      endpointUrl: '',
      tokenLimit: 1000,
      spendingThreshold: 0,
    },
  });

  const handleValidSubmit = async (data: AgentCreationFormData) => {
    try {
      await onSubmit(data);
      toast.success(`Agent "${data.name}" created.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create agent.';
      toast.error(message);
    }
  };

  const handleInvalidSubmit = (fieldErrors: FieldErrors<AgentCreationFormData>) => {
    toast.error('Invalid agent configuration.', {
      description:
        getFirstValidationMessage(fieldErrors) ??
        'Please resolve the highlighted validation errors.',
    });
  };

  return (
    <form
      onSubmit={handleSubmit(handleValidSubmit, handleInvalidSubmit)}
      className="space-y-4"
      noValidate
    >
      <FormField label="Agent Name" htmlFor="agent-create-name" required error={errors.name?.message}>
        <Input
          id="agent-create-name"
          invalid={Boolean(errors.name)}
          {...register('name')}
        />
      </FormField>

      <FormField
        label="Provider"
        htmlFor="agent-create-provider"
        required
        error={errors.provider?.message}
      >
        <Input
          id="agent-create-provider"
          invalid={Boolean(errors.provider)}
          {...register('provider')}
        />
      </FormField>

      <FormField label="Model" htmlFor="agent-create-model" required error={errors.model?.message}>
        <Input
          id="agent-create-model"
          invalid={Boolean(errors.model)}
          {...register('model')}
        />
      </FormField>

      <FormField label="API Key (Optional)" htmlFor="agent-create-api-key" error={errors.apiKey?.message}>
        <Input
          id="agent-create-api-key"
          type="password"
          invalid={Boolean(errors.apiKey)}
          {...register('apiKey')}
        />
      </FormField>

      <FormField
        label="Endpoint URL (Optional)"
        htmlFor="agent-create-endpoint"
        error={errors.endpointUrl?.message}
      >
        <Input
          id="agent-create-endpoint"
          type="url"
          invalid={Boolean(errors.endpointUrl)}
          {...register('endpointUrl')}
        />
      </FormField>

      <FormField
        label="Token Limit"
        htmlFor="agent-create-token-limit"
        required
        error={errors.tokenLimit?.message}
      >
        <Input
          id="agent-create-token-limit"
          type="number"
          invalid={Boolean(errors.tokenLimit)}
          {...register('tokenLimit', { valueAsNumber: true })}
        />
      </FormField>

      <FormField
        label="Spending Threshold"
        htmlFor="agent-create-spending-threshold"
        required
        error={errors.spendingThreshold?.message}
      >
        <Input
          id="agent-create-spending-threshold"
          type="number"
          step="0.01"
          invalid={Boolean(errors.spendingThreshold)}
          {...register('spendingThreshold', { valueAsNumber: true })}
        />
      </FormField>

      <Button type="submit" variant="primary" loading={isSubmitting} className="w-full">
        Create Agent
      </Button>
    </form>
  );
};

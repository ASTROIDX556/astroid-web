import React from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormField, Input, Select } from '@/components/ui/input';
import {
  agentCreationSchema,
  getFirstValidationMessage,
  type AgentCreationFormValues,
} from '../../lib/validations/agent';

interface AgentCreationFormProps {
  onSubmit: (data: AgentCreationFormValues) => void | Promise<void>;
}

export const AgentCreationForm: React.FC<AgentCreationFormProps> = ({ onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AgentCreationFormValues>({
    resolver: zodResolver(agentCreationSchema),
    defaultValues: {
      name: '',
      provider: 'openai',
      model: 'gpt-4',
      apiKey: '',
      endpointUrl: '',
      tokenLimit: 2048,
      spendingThreshold: 50,
    },
  });

  const handleValidSubmit = async (data: AgentCreationFormValues) => {
    try {
      await onSubmit(data);
      toast.success(`Agent "${data.name}" created.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create agent.';
      toast.error(message);
    }
  };

  const handleInvalidSubmit = (fieldErrors: FieldErrors<AgentCreationFormValues>) => {
    toast.error('Invalid agent configuration.', {
      description:
        getFirstValidationMessage(fieldErrors) ??
        'Please resolve the highlighted validation errors.',
    });
  };

  return (
    <form
      onSubmit={handleSubmit(handleValidSubmit, handleInvalidSubmit)}
      className="max-w-lg space-y-4"
      noValidate
    >
      <FormField label="Agent Name" htmlFor="agents-create-name" required error={errors.name?.message}>
        <Input
          id="agents-create-name"
          invalid={Boolean(errors.name)}
          {...register('name')}
        />
      </FormField>

      <FormField
        label="Provider"
        htmlFor="agents-create-provider"
        required
        error={errors.provider?.message}
      >
        <Select
          id="agents-create-provider"
          invalid={Boolean(errors.provider)}
          {...register('provider')}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="custom">Custom</option>
        </Select>
      </FormField>

      <FormField label="Model" htmlFor="agents-create-model" required error={errors.model?.message}>
        <Input
          id="agents-create-model"
          invalid={Boolean(errors.model)}
          {...register('model')}
        />
      </FormField>

      <FormField label="API Key" htmlFor="agents-create-api-key" error={errors.apiKey?.message}>
        <Input
          id="agents-create-api-key"
          type="password"
          invalid={Boolean(errors.apiKey)}
          {...register('apiKey')}
        />
      </FormField>

      <FormField
        label="Endpoint URL"
        htmlFor="agents-create-endpoint"
        error={errors.endpointUrl?.message}
      >
        <Input
          id="agents-create-endpoint"
          type="url"
          invalid={Boolean(errors.endpointUrl)}
          {...register('endpointUrl')}
        />
      </FormField>

      <FormField
        label="Token Limit"
        htmlFor="agents-create-token-limit"
        required
        error={errors.tokenLimit?.message}
      >
        <Input
          id="agents-create-token-limit"
          type="number"
          invalid={Boolean(errors.tokenLimit)}
          {...register('tokenLimit', { valueAsNumber: true })}
        />
      </FormField>

      <FormField
        label="Spending Threshold ($)"
        htmlFor="agents-create-spending-threshold"
        required
        error={errors.spendingThreshold?.message}
      >
        <Input
          id="agents-create-spending-threshold"
          type="number"
          step="0.01"
          invalid={Boolean(errors.spendingThreshold)}
          {...register('spendingThreshold', { valueAsNumber: true })}
        />
      </FormField>

      <Button type="submit" variant="primary" loading={isSubmitting} className="w-full">
        {isSubmitting ? 'Creating...' : 'Create Agent'}
      </Button>
    </form>
  );
};

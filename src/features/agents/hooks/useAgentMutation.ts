'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateAgentInput } from '../schema';

export interface AgentUpdateVariables {
  id?: string;
  data: Partial<CreateAgentInput>;
}

/**
 * Hook for updating or configuring an AI agent with optimistic updates,
 * query cache rollback on failure, and non-blocking sonner toast notifications.
 */
export function useAgentMutation(agentId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['agents', agentId];

  return useMutation({
    mutationFn: async (variables: AgentUpdateVariables) => {
      // Simulate network request or call API
      await new Promise((resolve) => {
        setTimeout(resolve, 600);
      });
      return variables.data;
    },
    onMutate: async (newAgentData) => {
      await queryClient.cancelQueries({ queryKey });

      const previousAgent = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: any) => ({
        ...(old || {}),
        ...newAgentData.data,
      }));

      return { previousAgent };
    },
    onError: (err, _newAgentData, context) => {
      if (context?.previousAgent) {
        queryClient.setQueryData(queryKey, context.previousAgent);
      }
      toast.error('Failed to update agent configuration', {
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    },
    onSuccess: (data: Partial<CreateAgentInput>) => {
      toast.success('Agent configuration updated successfully', {
        description: `${data.name || 'Agent'} parameters saved with instant UI feedback.`,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateAgentInput } from '../schema';


export interface AgentUpdateVariables {
  id?: string;
  data: Partial<CreateAgentInput>;
}
export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  spendingThreshold: number;
  allowedModels: string[];
  fallbackProvider: string;
  [key: string]: any;
}

async function updateAgentApi(agent: AgentConfig): Promise<AgentConfig> {
  const response = await fetch(`/api/agents/${agent.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent),
  });
  if (!response.ok) {
    throw new Error('Failed to update agent configuration');
  }
  return response.json();
}

export function useAgentMutation(agentId?: string) {
  const effectiveAgentId = agentId || 'agent-mock-id';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: AgentUpdateVariables) => {
      const id = variables.id || effectiveAgentId;
      return updateAgentApi({ id, name: 'Agent', model: 'gpt-4', spendingThreshold: 100, allowedModels: [], fallbackProvider: 'openai', ...variables.data });
    },
    onMutate: async (variables: AgentUpdateVariables) => {
      const id = variables.id || effectiveAgentId;
      await queryClient.cancelQueries({ queryKey: ['agent', id] });

      const previousAgent = queryClient.getQueryData<AgentConfig>(['agent', id]);

      queryClient.setQueryData(['agent', id], (old: AgentConfig | undefined) => {
        return old ? { ...old, ...variables.data } : { id, name: 'Agent', model: 'gpt-4', spendingThreshold: 100, allowedModels: [], fallbackProvider: 'openai', ...variables.data };
      });

      return { previousAgent, id };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousAgent && context?.id) {
        queryClient.setQueryData(['agent', context.id], context.previousAgent);
      }
      toast.error('Failed to update agent configuration. Changes rolled back.');
    },
    onSuccess: () => {
      toast.success('Agent configuration updated successfully!');
    },
    onSettled: (_data, _error, _variables, context) => {
      const id = context?.id || effectiveAgentId;
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
  });
}

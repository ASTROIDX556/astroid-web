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
  spendingThreshold?: number;
  allowedModels?: string[];
  fallbackProviders?: string[];
  [key: string]: any;
}

async function updateAgentApi(agent: AgentConfig): Promise<AgentConfig> {
  // Simulated API call
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (agent.name === 'FAIL_TEST') {
        reject(new Error('Failed to update agent'));
      } else {
        resolve(agent);
      }
    }, 200);
  });
}

export function useAgentMutation(agentId?: string) {
  const queryClient = useQueryClient();

  const effectiveId = agentId || 'agent-mock-id';

  return useMutation({
    mutationFn: (variables: AgentUpdateVariables) => {
      const id = variables.id || effectiveId;
      return updateAgentApi({ id, name: 'Agent', ...variables.data });
    },
    onMutate: async (variables) => {
      const id = variables.id || effectiveId;
      await queryClient.cancelQueries({ queryKey: ['agent', id] });

      const previousAgent = queryClient.getQueryData<AgentConfig>(['agent', id]);

      queryClient.setQueryData<AgentConfig>(['agent', id], (old) => {
        if (!old) return { id, name: 'Agent', ...variables.data };
        return { ...old, ...variables.data };
      });

      return { previousAgent, id };
    },
    onError: (err, _variables, context) => {
      if (context?.previousAgent && context?.id) {
        queryClient.setQueryData(['agent', context.id], context.previousAgent);
      }
      toast.error(`Failed to update agent config: ${err.message}`);
    },
    onSuccess: () => {
      toast.success('Agent configuration updated successfully');
    },
    onSettled: (_data, _error, _variables, context) => {
      const id = context?.id || effectiveId;
      queryClient.invalidateQueries({ queryKey: ['agent', id] });
    },
  });
}

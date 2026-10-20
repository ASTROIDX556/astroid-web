/**
 * The provider settings schema lives in `@/lib/validations/agent`. This module
 * re-exports it for the imports that predate that file.
 */
export {
  agentProviderConfigSchema,
  agentProviderTypes,
  providerModelOptions,
  type AgentProviderConfigValues,
  type AgentProviderType,
} from '@/lib/validations/agent';

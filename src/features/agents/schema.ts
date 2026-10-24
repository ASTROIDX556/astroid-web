/**
 * Agent form schemas live in `@/lib/validations/agent`. This module re-exports
 * them for the imports that predate that file, plus the aliases the agent
 * configuration form and its tests were first written against.
 *
 * The re-export is relative rather than `@/…` so this module — and the shared
 * rules it pulls in — can be compiled on its own by the `test:agents` script,
 * which runs `tsc` outside the app's `tsconfig` path aliases.
 */
export * from '../../lib/validations/agent';
export {
  AGENT_PROVIDERS as providerOptions,
  AGENT_PROVIDERS as AGENT_PROVIDER_IDS,
} from '../../lib/validations/agent';
/**
 * The configuration form's schema under its original name: `createAgentSchema`
 * is the single source of truth for the form's validation (endpoint, spending
 * limit, transaction cap, timeout), re-exported here so the form and its tests
 * share one set of rules.
 */
export {
  createAgentSchema as agentConfigSchema,
  type CreateAgentInput as AgentConfigFormValues,
} from '../../lib/validations/agent';

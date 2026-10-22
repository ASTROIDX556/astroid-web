import { describe, expect, it } from 'vitest';
import {
  agentProviderConfigSchema,
  type AgentProviderConfigValues,
} from '../src/features/agents/providerConfigSchema';

const base: AgentProviderConfigValues = {
  name: 'Treasury agent — production',
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  endpointUrl: '',
  apiKey: '',
};

function issuePaths(result: ReturnType<typeof agentProviderConfigSchema.safeParse>) {
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('agentProviderConfigSchema', () => {
  it('requires an API key for hosted commercial providers', () => {
    const result = agentProviderConfigSchema.safeParse({
      ...base,
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      apiKey: '',
    });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('apiKey');
  });

  it('accepts a hosted provider with a masked API key value', () => {
    const result = agentProviderConfigSchema.safeParse({
      ...base,
      apiKey: 'sk-live-example-value',
    });

    expect(result.success).toBe(true);
  });

  it('requires an endpoint URL for Ollama', () => {
    const result = agentProviderConfigSchema.safeParse({
      ...base,
      provider: 'ollama',
      model: 'llama3.1',
      apiKey: '',
      endpointUrl: '',
    });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('endpointUrl');
  });

  it('rejects malformed endpoint URLs for custom providers', () => {
    const result = agentProviderConfigSchema.safeParse({
      ...base,
      provider: 'custom',
      model: 'my-org/finance-agent-v1',
      endpointUrl: 'not-a-url',
    });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('endpointUrl');
  });

  it('accepts a custom provider with a valid endpoint and optional key', () => {
    const result = agentProviderConfigSchema.safeParse({
      ...base,
      provider: 'custom',
      model: 'my-org/finance-agent-v1',
      endpointUrl: 'https://inference.example.com/v1',
      apiKey: 'optional-bearer-token',
    });

    expect(result.success).toBe(true);
  });

  it('rejects out-of-range temperatures', () => {
    const result = agentProviderConfigSchema.safeParse({
      ...base,
      apiKey: 'sk-live-example-value',
      temperature: 2.5,
    });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('temperature');
  });
});

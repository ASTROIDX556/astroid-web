import assert from 'node:assert/strict';
import test from 'node:test';
import { agentConfigSchema } from './schema';
import { agentProviderConfigSchema } from './providerConfigSchema';

test('agent config rejects a model outside the selected provider catalog', () => {
  const result = agentConfigSchema.safeParse({
    name: 'Treasury agent',
    description: '',
    provider: 'OpenAI',
    model: 'claude-3-5-sonnet-latest',
    endpointUrl: '',
    mode: 'assisted',
    temperature: 0.2,
    monthlyBudget: 500,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path[0] === 'model'));
  }
});

test('provider configuration rejects an empty custom endpoint', () => {
  const result = agentProviderConfigSchema.safeParse({
    name: 'Local agent',
    provider: 'custom',
    model: 'finance-model-v1',
    temperature: 0.7,
    endpointUrl: '',
    apiKey: '',
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path[0] === 'endpointUrl'));
  }
});

test('accepts valid hosted provider configuration for every provider key format', () => {
  const cases = [
    ['nvidia', 'nemotron-4-340b', 'nvapi-abcdefghijklmnopqrst'],
    ['openai', 'gpt-4o', 'sk-proj-abcdefghijklmnopqrst'],
    ['anthropic', 'claude-sonnet-5', 'sk-ant-abcdefghijklmnopqrst'],
    ['gemini', 'gemini-2.5-pro', 'AIzaabcdefghijklmnopqrstuvwx'],
  ] as const;

  for (const [provider, model, apiKey] of cases) {
    const result = agentProviderConfigSchema.safeParse({
      name: `${provider} agent`,
      provider,
      model,
      temperature: 0.7,
      endpointUrl: '',
      apiKey,
    });
    assert.equal(result.success, true, `${provider} configuration should be valid`);
  }
});

test('rejects a missing provider and missing hosted API key', () => {
  const missingProvider = agentProviderConfigSchema.safeParse({
    name: 'Hosted agent',
    model: 'gpt-4o',
    temperature: 0.7,
  });
  assert.equal(missingProvider.success, false);

  const missingKey = agentProviderConfigSchema.safeParse({
    name: 'OpenAI agent',
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    apiKey: '',
  });
  assert.equal(missingKey.success, false);
  if (!missingKey.success) {
    assert.ok(missingKey.error.issues.some((issue) => issue.path[0] === 'apiKey'));
  }
});

test('rejects malformed hosted API key inputs', () => {
  const result = agentProviderConfigSchema.safeParse({
    name: 'OpenAI agent',
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    apiKey: 'not-an-openai-key',
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path[0] === 'apiKey'));
  }
});

test('requires a model and accepts Ollama without a hosted API key', () => {
  const missingModel = agentProviderConfigSchema.safeParse({
    name: 'Ollama agent',
    provider: 'ollama',
    model: '',
    temperature: 0.7,
    endpointUrl: 'http://localhost:11434',
  });
  assert.equal(missingModel.success, false);

  const ollama = agentProviderConfigSchema.safeParse({
    name: 'Ollama agent',
    provider: 'ollama',
    model: 'llama3.1',
    temperature: 0.7,
    endpointUrl: 'http://localhost:11434',
  });
  assert.equal(ollama.success, true);
});

test('validates provider model catalogs and temperature boundaries', () => {
  const invalidModel = agentProviderConfigSchema.safeParse({
    name: 'OpenAI agent',
    provider: 'openai',
    model: 'claude-sonnet-5',
    temperature: 0.7,
    apiKey: 'sk-abcdefghijklmnopqrst',
  });
  assert.equal(invalidModel.success, false);

  const boundary = agentProviderConfigSchema.safeParse({
    name: 'OpenAI agent',
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 2,
    apiKey: 'sk-abcdefghijklmnopqrst',
  });
  assert.equal(boundary.success, true);
});

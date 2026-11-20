import assert from 'node:assert/strict';
import test from 'node:test';
import { agentConfigSchema, agentWizardSchema } from './schema';
import {
  agentProviderConfigSchema,
  providerModelOptions,
  validateProviderApiKey,
  validateProviderEndpoint,
  type AgentProviderType,
} from './providerConfigSchema';

const issuesAt = (
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  field: string,
) => (result.error?.issues ?? []).filter((issue) => issue.path[0] === field).map((issue) => issue.message);

const VALID_KEYS: Record<Exclude<AgentProviderType, 'ollama' | 'custom'>, string> = {
  nvidia: `nvapi-${'A1b2'.repeat(10)}`,
  openai: `sk-proj-${'x9Y8'.repeat(10)}`,
  anthropic: `sk-ant-api03-${'Q'.repeat(40)}`,
  gemini: `AIza${'S'.repeat(35)}`,
};

const baseSettings = { name: 'Treasury agent', temperature: 0.4, endpointUrl: '', apiKey: '' };

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

// ---------------------------------------------------------------------------
// Provider-specific validation (#510)
// ---------------------------------------------------------------------------

test('provider configuration accepts a valid setup for every hosted provider', () => {
  for (const [provider, apiKey] of Object.entries(VALID_KEYS) as [keyof typeof VALID_KEYS, string][]) {
    const result = agentProviderConfigSchema.safeParse({
      ...baseSettings,
      provider,
      model: providerModelOptions[provider][0],
      apiKey,
    });
    assert.equal(result.success, true, `${provider}: ${JSON.stringify(result.error?.issues)}`);
  }
});

test('provider configuration accepts Ollama on a local http endpoint without a key', () => {
  const result = agentProviderConfigSchema.safeParse({
    ...baseSettings,
    provider: 'ollama',
    model: 'llama3.1',
    endpointUrl: 'http://localhost:11434',
  });
  assert.equal(result.success, true);
});

test('provider configuration rejects a key with the wrong provider prefix', () => {
  const result = agentProviderConfigSchema.safeParse({
    ...baseSettings,
    provider: 'anthropic',
    model: providerModelOptions.anthropic[0],
    apiKey: VALID_KEYS.openai,
  });
  assert.deepEqual(issuesAt(result, 'apiKey'), ['Anthropic API keys start with "sk-ant-".']);
});

test('provider configuration flags an Anthropic key pasted into OpenAI', () => {
  assert.match(validateProviderApiKey('openai', VALID_KEYS.anthropic) ?? '', /Anthropic key/);
});

test('provider configuration enforces key length constraints', () => {
  assert.match(validateProviderApiKey('openai', 'sk-short') ?? '', /too short/);
  assert.match(validateProviderApiKey('nvidia', `nvapi-${'a'.repeat(200)}`) ?? '', /too long/);
  assert.match(validateProviderApiKey('gemini', `AIza${'S'.repeat(30)}`) ?? '', /exactly 39/);
  assert.match(validateProviderApiKey('custom', 'tiny') ?? '', /too short/);
  assert.equal(validateProviderApiKey('ollama', 'anything'), null);
});

test('provider configuration rejects unsupported characters in a key', () => {
  assert.match(validateProviderApiKey('gemini', `AIza${'S'.repeat(34)}!`) ?? '', /unsupported characters/);
});

test('provider configuration rejects a model outside each provider catalog', () => {
  for (const provider of ['nvidia', 'openai', 'anthropic', 'gemini', 'ollama'] as const) {
    const result = agentProviderConfigSchema.safeParse({
      ...baseSettings,
      provider,
      model: 'definitely-not-a-model',
      apiKey: provider === 'ollama' ? '' : VALID_KEYS[provider],
      endpointUrl: provider === 'ollama' ? 'http://localhost:11434' : '',
    });
    assert.ok(issuesAt(result, 'model').length > 0, provider);
  }
});

test('custom provider model names must be identifiers, not free text', () => {
  const result = agentProviderConfigSchema.safeParse({
    ...baseSettings,
    provider: 'custom',
    model: 'my model; drop table',
    endpointUrl: 'https://llm.internal.example.com/v1',
  });
  assert.ok(issuesAt(result, 'model').length > 0);
});

test('hosted provider endpoints must use HTTPS', () => {
  assert.equal(
    validateProviderEndpoint('openai', 'http://api.openai.com/v1'),
    'OpenAI endpoints must use HTTPS.',
  );
  assert.equal(validateProviderEndpoint('OpenAI', 'https://api.openai.com/v1'), null);
});

test('custom endpoints need HTTPS unless they are on a private network', () => {
  assert.match(validateProviderEndpoint('custom', 'http://llm.example.com/v1') ?? '', /HTTPS/);
  for (const url of ['http://localhost:8000/v1', 'http://127.0.0.1:8080', 'http://192.168.1.20/v1', 'http://10.0.0.5', 'http://gpu-box.local:8000']) {
    assert.equal(validateProviderEndpoint('custom', url), null, url);
  }
});

test('endpoints may not embed credentials or fragments', () => {
  const result = agentProviderConfigSchema.safeParse({
    ...baseSettings,
    provider: 'custom',
    model: 'finance-model-v1',
    endpointUrl: 'https://user:secret@llm.example.com/v1',
  });
  assert.deepEqual(issuesAt(result, 'endpointUrl'), [
    'Endpoint URL must not contain credentials. Use the API key field instead.',
  ]);
  assert.match(validateProviderEndpoint('ollama', 'http://localhost:11434/#x') ?? '', /fragment/);
});

test('malformed endpoints report a single error', () => {
  const result = agentProviderConfigSchema.safeParse({
    ...baseSettings,
    provider: 'custom',
    model: 'finance-model-v1',
    endpointUrl: 'javascript:alert(1)',
  });
  assert.equal(issuesAt(result, 'endpointUrl').length, 1);
});

test('agent creation applies endpoint rules for the selected provider', () => {
  const result = agentConfigSchema.safeParse({
    name: 'Treasury agent',
    description: '',
    provider: 'Custom',
    model: 'finance-model-v1',
    endpointUrl: 'http://public-llm.example.com/v1',
    mode: 'assisted',
    temperature: 0.2,
    monthlyBudget: 500,
  });
  assert.equal(result.success, false);
  assert.ok(issuesAt(result, 'endpointUrl').length > 0);
});

test('agent wizard validates the API key format for the chosen provider', () => {
  const wizard = {
    name: 'Treasury agent',
    description: 'Rebalances treasury holdings weekly.',
    ownerDepartment: 'Finance',
    provider: 'Anthropic',
    model: 'claude-3-5-sonnet-latest',
    endpointUrl: '',
    budget: 1000,
    singleTransactionCap: 100,
  };
  assert.equal(agentWizardSchema.safeParse({ ...wizard, apiKey: VALID_KEYS.anthropic }).success, true);
  const bad = agentWizardSchema.safeParse({ ...wizard, apiKey: 'sk-ant-short' });
  assert.match(issuesAt(bad, 'apiKey')[0] ?? '', /too short/);
});

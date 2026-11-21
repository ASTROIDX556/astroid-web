import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_PROVIDERS,
  PROVIDER_MODELS,
  agentConfigurationEditorSchema,
  agentConfigSchema,
  agentModelVersionSchema,
  spendingLimitSchema,
  type AgentConfigurationEditorInput,
} from './schema';
import { agentProviderConfigSchema } from './providerConfigSchema';

type ParseResult =
  | { success: true; data: AgentConfigurationEditorInput }
  | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };

/** First validation message for a field, including errors on array items. */
const issueFor = (result: ParseResult, field: string) =>
  (result.success ? [] : result.error.issues).find((issue) => issue.path[0] === field)?.message;

const validEditorConfig = {
  provider: 'Nvidia',
  model: 'meta/llama-3.1-405b-instruct',
  maxBudget: 500,
  allowedScopes: ['wallet.read', 'analytics.read'],
  tokenAllocation: 4_096,
} as const;

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

test('editor schema accepts a valid configuration and trims the model name', () => {
  const result = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    model: '  meta/llama-3.1-405b-instruct  ',
  });

  assert.equal(result.success, true);
  if (result.success) {
    const parsed: AgentConfigurationEditorInput = result.data;
    assert.equal(parsed.model, 'meta/llama-3.1-405b-instruct');
    assert.deepEqual(parsed.allowedScopes, ['wallet.read', 'analytics.read']);
  }
});

test('editor schema accepts every supported provider with a catalog model', () => {
  for (const provider of AGENT_PROVIDERS) {
    const config = {
      ...validEditorConfig,
      provider,
      model: provider === 'Custom' ? 'my-org/finance-agent-v1' : PROVIDER_MODELS[provider][0] ?? '',
      endpointUrl: provider === 'Custom' || provider === 'Ollama' ? 'http://localhost:11434' : '',
    };
    assert.equal(agentConfigurationEditorSchema.safeParse(config).success, true, provider);
  }
});

test('editor schema rejects unsupported provider strings', () => {
  for (const provider of ['Skynet', 'openai', '', '  ']) {
    const result = agentConfigurationEditorSchema.safeParse({
      ...validEditorConfig,
      provider,
    }) as ParseResult;
    assert.equal(issueFor(result, 'provider'), 'Select a supported provider.', provider);
  }
});

test('editor schema rejects empty or whitespace-only model names', () => {
  for (const model of ['', '   ']) {
    const result = agentConfigurationEditorSchema.safeParse({
      ...validEditorConfig,
      model,
    }) as ParseResult;
    assert.ok(issueFor(result, 'model'), model);
  }
});

test('editor schema rejects a model from another provider catalog', () => {
  const result = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    provider: 'OpenAI',
    model: 'claude-3-5-sonnet-latest',
  }) as ParseResult;
  assert.equal(issueFor(result, 'model'), 'Select a model offered by OpenAI.');
});

test('editor schema requires a positive max budget', () => {
  for (const maxBudget of [0, -25, '', '   ', 100_000_001]) {
    const result = agentConfigurationEditorSchema.safeParse({
      ...validEditorConfig,
      maxBudget,
    }) as ParseResult;
    assert.ok(issueFor(result, 'maxBudget'), String(maxBudget));
  }
});

test('editor schema requires at least one known, unique allowed scope', () => {
  const empty = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    allowedScopes: [],
  }) as ParseResult;
  assert.equal(issueFor(empty, 'allowedScopes'), 'Grant at least one allowed scope.');

  const unknown = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    allowedScopes: ['wallet.read', 'root.access'],
  }) as ParseResult;
  assert.equal(issueFor(unknown, 'allowedScopes'), 'Unsupported permission scope.');

  const duplicates = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    allowedScopes: ['wallet.read', 'wallet.read'],
  }) as ParseResult;
  assert.equal(issueFor(duplicates, 'allowedScopes'), 'Allowed scopes must be unique.');
});

test('editor schema requires a positive whole-number token allocation', () => {
  for (const tokenAllocation of [0, -1, -4_096, 1.5, '', '   ']) {
    const result = agentConfigurationEditorSchema.safeParse({
      ...validEditorConfig,
      tokenAllocation,
    }) as ParseResult;
    assert.ok(issueFor(result, 'tokenAllocation'), String(tokenAllocation));
  }
});

test('editor schema requires an http(s) endpoint for self-hosted providers', () => {
  for (const provider of ['Ollama', 'Custom'] as const) {
    const model = provider === 'Custom' ? 'my-org/finance-agent-v1' : PROVIDER_MODELS.Ollama[0] ?? '';

    const missing = agentConfigurationEditorSchema.safeParse({
      ...validEditorConfig,
      provider,
      model,
    }) as ParseResult;
    assert.equal(
      issueFor(missing, 'endpointUrl'),
      'A valid API endpoint URL is required for this provider.',
    );

    const invalid = agentConfigurationEditorSchema.safeParse({
      ...validEditorConfig,
      provider,
      model,
      endpointUrl: 'javascript:alert(1)',
    }) as ParseResult;
    assert.ok(issueFor(invalid, 'endpointUrl'), provider);

    const valid = agentConfigurationEditorSchema.safeParse({
      ...validEditorConfig,
      provider,
      model,
      endpointUrl: 'https://inference.example.com/v1',
    });
    assert.equal(valid.success, true, provider);
  }
});

// ---------------------------------------------------------------------------
// Model version strings and refined spending limits (#556, #524)
// ---------------------------------------------------------------------------

test('agentModelVersionSchema validates structured model identifiers and tags', () => {
  const validModels = [
    'meta/llama-3.1-405b-instruct',
    'mistralai/mistral-large-2',
    'gpt-4o-2024-08-06',
    'claude-3-5-sonnet@20241022',
    'custom-model:v1.2.3',
    'my_org/finance_agent_v2.1',
  ];

  for (const model of validModels) {
    const result = agentModelVersionSchema.safeParse(model);
    assert.equal(result.success, true, model);
  }

  const invalidModels = [
    'model with spaces',
    'meta/llama$invalid',
    'model<script>',
    '',
    '   ',
  ];

  for (const model of invalidModels) {
    const result = agentModelVersionSchema.safeParse(model);
    assert.equal(result.success, false, model);
  }
});

test('editor schema rejects model strings containing invalid version characters', () => {
  const result = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    provider: 'Custom',
    model: 'custom model with spaces',
    endpointUrl: 'https://inference.example.com/v1',
  }) as ParseResult;

  assert.equal(result.success, false);
  assert.equal(issueFor(result, 'model'), 'Model version string contains invalid characters.');
});

test('spendingLimitSchema enforces positive finite numerical bounds', () => {
  assert.equal(spendingLimitSchema.safeParse(500).success, true);
  assert.equal(spendingLimitSchema.safeParse(100_000_000).success, true);

  for (const invalid of [0, -10, NaN, Infinity, -Infinity, 100_000_001, '500']) {
    assert.equal(spendingLimitSchema.safeParse(invalid).success, false, String(invalid));
  }
});

test('editor schema enforces dailySpendingLimit within maxBudget', () => {
  const valid = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    maxBudget: 1000,
    dailySpendingLimit: 250,
  });
  assert.equal(valid.success, true);

  const exceeded = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    maxBudget: 1000,
    dailySpendingLimit: 1500,
  }) as ParseResult;
  assert.equal(exceeded.success, false);
  assert.equal(
    issueFor(exceeded, 'dailySpendingLimit'),
    'Daily spending limit cannot exceed the max budget.',
  );
});

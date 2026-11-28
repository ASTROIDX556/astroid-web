import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  AGENT_PROVIDERS,
  PROVIDER_MODELS,
  agentConfigPanelSchema,
  agentConfigurationEditorSchema,
  agentConfigSchema,
  agentConfigurationSchema,
  agentProviderConfigSchema as providerSettingsSchema,
  agentWizardSchema,
  getFirstValidationMessage,
  templateWizardSchema,
  updateAgentSchema,
  type AgentConfigurationEditorInput,
} from './schema';
import { agentProviderConfigSchema } from './providerConfigSchema';

type ParseResult =
  | { success: true }
  | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };

/** First validation message for a field, including errors on array items. */
const issueFor = (result: ParseResult, field: string) =>
  (result.success ? [] : result.error.issues).find((issue) => issue.path[0] === field)?.message;

const validAgentConfig = {
  name: 'Treasury agent',
  provider: 'Nvidia',
  model: 'meta/llama-3.1-405b-instruct',
  mode: 'assisted',
  temperature: 0.2,
  maxTokens: 2_048,
  monthlyBudget: 500,
} as const;

const validPanelConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2_048,
  systemPrompt: 'You are a treasury agent.',
} as const;

const validEditorConfig = {
  provider: 'Nvidia',
  model: 'meta/llama-3.1-405b-instruct',
  maxBudget: 500,
  allowedScopes: ['wallet.read', 'analytics.read'],
  tokenAllocation: 4_096,
} as const;

test('create schema enforces the inclusive 0–2 temperature range', () => {
  for (const temperature of [0, 2]) {
    assert.equal(
      agentConfigSchema.safeParse({ ...validAgentConfig, temperature }).success,
      true,
      String(temperature),
    );
  }

  for (const temperature of [-0.1, -1, 2.1, 3]) {
    const result = agentConfigSchema.safeParse({
      ...validAgentConfig,
      temperature,
    }) as ParseResult;
    assert.ok(issueFor(result, 'temperature'), String(temperature));
  }
});

test('create schema rejects negative and zero monthly spending limits', () => {
  for (const monthlyBudget of [-500, -0.01, 0]) {
    const result = agentConfigSchema.safeParse({
      ...validAgentConfig,
      monthlyBudget,
    }) as ParseResult;
    assert.ok(issueFor(result, 'monthlyBudget'), String(monthlyBudget));
  }
});

test('create schema requires a positive whole-number max tokens cap', () => {
  for (const maxTokens of [0, -1, -2_048, 1.5, 1_000_001]) {
    const result = agentConfigSchema.safeParse({
      ...validAgentConfig,
      maxTokens,
    }) as ParseResult;
    assert.ok(issueFor(result, 'maxTokens'), String(maxTokens));
  }

  for (const maxTokens of [1, 1_000_000]) {
    assert.equal(
      agentConfigSchema.safeParse({ ...validAgentConfig, maxTokens }).success,
      true,
      String(maxTokens),
    );
  }
});

test('update schema applies the same temperature, budget, and token bounds to provided fields', () => {
  const invalid = updateAgentSchema.safeParse({
    temperature: -0.5,
    monthlyBudget: -100,
    maxTokens: 0,
  }) as ParseResult;
  assert.ok(issueFor(invalid, 'temperature'));
  assert.ok(issueFor(invalid, 'monthlyBudget'));
  assert.ok(issueFor(invalid, 'maxTokens'));

  const valid = updateAgentSchema.safeParse({ temperature: 1.5, maxTokens: 4_096 });
  assert.equal(valid.success, true);
});

test('panel schema accepts a valid configuration and rejects out-of-range values', () => {
  assert.equal(agentConfigPanelSchema.safeParse(validPanelConfig).success, true);

  for (const temperature of [-0.1, 2.1]) {
    const result = agentConfigPanelSchema.safeParse({
      ...validPanelConfig,
      temperature,
    }) as ParseResult;
    assert.ok(issueFor(result, 'temperature'), String(temperature));
  }

  for (const maxTokens of [0, -1, 1.5, 1_000_001]) {
    const result = agentConfigPanelSchema.safeParse({
      ...validPanelConfig,
      maxTokens,
    }) as ParseResult;
    assert.ok(issueFor(result, 'maxTokens'), String(maxTokens));
  }
});

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

test('agent configuration requires a spending cap for each enabled asset', () => {
  const result = agentConfigSchema.safeParse({
    name: 'Treasury agent',
    description: '',
    provider: 'OpenAI',
    model: 'gpt-4o',
    endpointUrl: '',
    mode: 'assisted',
    temperature: 0.2,
    monthlyBudget: 500,
    assetPermissions: {
      USDC: { allowed: true, maxSpend: null },
      XLM: { allowed: false, maxSpend: null },
      EURC: { allowed: true, maxSpend: 25 },
      ASTRO: { allowed: false, maxSpend: null },
    },
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(
      result.error.issues.some(
        (issue) =>
          issue.path.join('.') === 'assetPermissions.USDC.maxSpend' &&
          issue.message === 'Set a spending limit for enabled USDC assets.',
      ),
    );
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

describe('agent form schemas & validation helpers', () => {
  const base = {
    name: 'Treasury Guard',
    description: 'Automated Stellar rebalancing assistant',
    provider: 'Nvidia' as const,
    model: 'meta/llama-3.1-405b-instruct',
    endpointUrl: '',
    mode: 'assisted' as const,
    temperature: 0.2,
    monthlyBudget: 500,
    dailyBudget: 100,
    singleTransactionCap: 100,
    maxSpendPerTransaction: 25,
    timeoutSeconds: 60,
    rateLimitPerMinute: 60,
    tokenThreshold: 4096,
  };
  const hasErr = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }, f: string) =>
    !r.success && Boolean(r.error?.issues.some((i) => i.path.includes(f)));

  test('createAgentSchema & updateAgentSchema enforce endpoints, catalog models, NaN, and budget caps', () => {
    assert.equal(agentConfigSchema.safeParse(base).success, true);
    assert.ok(hasErr(agentConfigSchema.safeParse({ ...base, provider: 'Custom', model: 'v2', endpointUrl: '' }), 'endpointUrl'));
    assert.ok(hasErr(agentConfigSchema.safeParse({ ...base, provider: 'Ollama', model: 'llama3.1:70b', endpointUrl: 'ftp://host' }), 'endpointUrl'));
    assert.equal(agentConfigSchema.safeParse({ ...base, provider: 'Ollama', model: 'llama3.1:70b', endpointUrl: 'http://localhost:11434' }).success, true);
    assert.ok(hasErr(agentConfigSchema.safeParse({ ...base, provider: 'OpenAI', model: 'claude-3-opus' }), 'model'));
    assert.ok(hasErr(agentConfigSchema.safeParse({ ...base, temperature: 2.5 }), 'temperature'));
    assert.ok(hasErr(agentConfigSchema.safeParse({ ...base, monthlyBudget: Number.NaN }), 'monthlyBudget'));
    assert.ok(hasErr(agentConfigSchema.safeParse({ ...base, monthlyBudget: 200, singleTransactionCap: 250 }), 'singleTransactionCap'));
    assert.ok(hasErr(agentConfigSchema.safeParse({ ...base, monthlyBudget: 200, dailyBudget: 300 }), 'dailyBudget'));
    assert.ok(hasErr(agentConfigSchema.safeParse({ ...base, dailyBudget: 100, maxSpendPerTransaction: 150 }), 'maxSpendPerTransaction'));

    assert.equal(updateAgentSchema.safeParse({}).success, false);
    assert.ok(hasErr(updateAgentSchema.safeParse({ provider: 'Custom' }), 'endpointUrl'));
    assert.equal(updateAgentSchema.safeParse({ temperature: 0.8, monthlyBudget: 2500 }).success, true);
  });

  test('wizard, provider, panel, configuration schemas & getFirstValidationMessage', () => {
    const validOpenAiKey = `sk-${'a'.repeat(40)}`;
    const wiz = { name: 'Copilot', description: 'Monitors Stellar treasury balances.', ownerDepartment: 'Treasury', provider: 'OpenAI' as const, model: 'gpt-4o-mini', apiKey: validOpenAiKey, endpointUrl: 'https://api.openai.com/v1', contextWindowTokens: 128_000, budget: 5000, singleTransactionCap: 1500 };
    assert.equal(agentWizardSchema.safeParse(wiz).success, true);
    assert.ok(hasErr(agentWizardSchema.safeParse({ ...wiz, budget: 1000, singleTransactionCap: 1500 }), 'singleTransactionCap'));
    assert.ok(hasErr(agentWizardSchema.safeParse({ ...wiz, apiKey: 'bad key' }), 'apiKey'));

    const tpl = { templateId: 'arb', name: 'DEX Alpha', description: 'Governed cross-pair Stellar arbitrage.', ownerDepartment: 'Trading', provider: 'Anthropic' as const, model: 'claude-3-5-sonnet-latest', apiKey: '', budget: 10_000, singleTransactionCap: 2_000, maxHourlyBudgetUsd: 50, requireApprovalAbove: undefined, allowedNetworks: ['Stellar Mainnet'] };
    assert.equal(templateWizardSchema.safeParse(tpl).success, true);
    const blank = templateWizardSchema.safeParse({ ...tpl, requireApprovalAbove: '' });
    assert.equal(blank.success && blank.data.requireApprovalAbove, undefined);
    assert.ok(hasErr(templateWizardSchema.safeParse({ ...tpl, budget: 5_000, requireApprovalAbove: 6_000 }), 'requireApprovalAbove'));
    assert.ok(hasErr(templateWizardSchema.safeParse({ ...tpl, allowedNetworks: [] }), 'allowedNetworks'));

    const prov = { name: 'Prod OpenAI', provider: 'openai' as const, model: 'gpt-4o', temperature: 0.5, endpointUrl: '', apiKey: '' };
    assert.ok(hasErr(providerSettingsSchema.safeParse(prov), 'apiKey'));
    assert.equal(providerSettingsSchema.safeParse({ ...prov, apiKey: validOpenAiKey }).success, true);
    assert.ok(hasErr(providerSettingsSchema.safeParse({ ...prov, provider: 'ollama', model: 'llama3.1' }), 'endpointUrl'));

    const panel = { provider: 'anthropic' as const, model: 'claude-sonnet-5', temperature: 0.7, maxTokens: 2048, systemPrompt: 'Stay within bounds.' };
    assert.equal(agentConfigPanelSchema.safeParse(panel).success, true);
    assert.ok(hasErr(agentConfigPanelSchema.safeParse({ ...panel, systemPrompt: '   ' }), 'systemPrompt'));
    assert.ok(hasErr(agentConfigPanelSchema.safeParse({ ...panel, provider: 'gemini' }), 'model'));

    assert.ok(hasErr(agentConfigurationSchema.safeParse({ name: 'Sentinel', description: 'Audits outgoing Stellar transactions.', provider: 'OpenAI', model: 'gpt-4o', endpointUrl: '', mode: 'assisted', temperature: 0.1, monthlyBudget: 1000, dailySpendingLimit: 200, capabilities: [] }), 'capabilities'));
    assert.equal(getFirstValidationMessage({ nested: { budget: { message: 'Budget > 0' } } }), 'Budget > 0');
    const cyc: Record<string, unknown> = { message: '' };
    cyc.ref = cyc;
    cyc.self = cyc;
    assert.equal(getFirstValidationMessage({ empty: cyc }), undefined);
  });
});

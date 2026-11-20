import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import { agentProviderConfigSchema as standaloneProviderConfigSchema } from './providerConfigSchema';
import {
  AGENT_PROVIDERS,
  PROVIDER_MODELS,
  agentConfigPanelSchema,
  agentConfigSchema,
  agentConfigurationEditorSchema,
  agentConfigurationSchema,
  agentProviderConfigSchema,
  agentWizardSchema,
  getFirstValidationMessage,
  templateWizardSchema,
  updateAgentSchema,
  type AgentConfigurationEditorInput,
} from './schema';

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
    provider: 'Nvidia',
    model: 'gpt-4o',
    endpointUrl: '',
    mode: 'assisted',
    temperature: 0.2,
    monthlyBudget: 500,
    singleTransactionCap: 100,
    timeoutSeconds: 60,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path[0] === 'model'));
  }
});

test('provider configuration rejects an empty custom endpoint', () => {
  const result = standaloneProviderConfigSchema.safeParse({
    name: 'Local custom',
    provider: 'custom',
    model: 'my-model',
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

describe('agentConfigSchema (createAgentSchema)', () => {
  const validPayload = {
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

  test('accepts a complete valid hosted-provider configuration', () => {
    const result = agentConfigSchema.safeParse(validPayload);
    assert.equal(result.success, true);
  });

  test('requires an http(s) endpoint URL for Custom and Ollama providers', () => {
    const missingCustomEndpoint = agentConfigSchema.safeParse({
      ...validPayload,
      provider: 'Custom',
      model: 'my-fine-tune-v2',
      endpointUrl: '',
    });
    assert.equal(missingCustomEndpoint.success, false);
    assert.ok(
      missingCustomEndpoint.error.issues.some((issue) => issue.path.includes('endpointUrl')),
    );

    const invalidScheme = agentConfigSchema.safeParse({
      ...validPayload,
      provider: 'Ollama',
      model: 'llama3.1:70b',
      endpointUrl: 'ftp://localhost:11434',
    });
    assert.equal(invalidScheme.success, false);
    assert.ok(invalidScheme.error.issues.some((issue) => issue.path.includes('endpointUrl')));

    const validOllama = agentConfigSchema.safeParse({
      ...validPayload,
      provider: 'Ollama',
      model: 'llama3.1:70b',
      endpointUrl: 'http://localhost:11434',
    });
    assert.equal(validOllama.success, true);
  });

  test('rejects models not offered by the selected hosted provider', () => {
    const result = agentConfigSchema.safeParse({
      ...validPayload,
      provider: 'OpenAI',
      model: 'claude-sonnet-4-20250514',
    });
    assert.equal(result.success, false);
    assert.ok(result.error.issues.some((issue) => issue.path.includes('model')));
  });

  test('enforces temperature bounds and cross-field budget hierarchy', () => {
    const outOfRangeTemp = agentConfigSchema.safeParse({
      ...validPayload,
      temperature: 2.5,
    });
    assert.equal(outOfRangeTemp.success, false);
    assert.ok(outOfRangeTemp.error.issues.some((issue) => issue.path.includes('temperature')));

    const capExceedsMonthly = agentConfigSchema.safeParse({
      ...validPayload,
      monthlyBudget: 200,
      singleTransactionCap: 250,
    });
    assert.equal(capExceedsMonthly.success, false);
    assert.ok(
      capExceedsMonthly.error.issues.some((issue) => issue.path.includes('singleTransactionCap')),
    );

    const dailyExceedsMonthly = agentConfigSchema.safeParse({
      ...validPayload,
      monthlyBudget: 200,
      dailyBudget: 300,
    });
    assert.equal(dailyExceedsMonthly.success, false);
    assert.ok(
      dailyExceedsMonthly.error.issues.some((issue) => issue.path.includes('dailyBudget')),
    );

    const maxSpendExceedsDaily = agentConfigSchema.safeParse({
      ...validPayload,
      monthlyBudget: 500,
      dailyBudget: 100,
      maxSpendPerTransaction: 150,
    });
    assert.equal(maxSpendExceedsDaily.success, false);
    assert.ok(
      maxSpendExceedsDaily.error.issues.some((issue) =>
        issue.path.includes('maxSpendPerTransaction'),
      ),
    );
  });
});

describe('updateAgentSchema', () => {
  test('rejects empty update payloads and enforces endpoint when switching to Custom', () => {
    const emptyUpdate = updateAgentSchema.safeParse({});
    assert.equal(emptyUpdate.success, false);

    const customWithoutEndpoint = updateAgentSchema.safeParse({
      provider: 'Custom',
    });
    assert.equal(customWithoutEndpoint.success, false);
    assert.ok(
      customWithoutEndpoint.error.issues.some((issue) => issue.path.includes('endpointUrl')),
    );

    const validPartialUpdate = updateAgentSchema.safeParse({
      temperature: 0.8,
      monthlyBudget: 2500,
    });
    assert.equal(validPartialUpdate.success, true);
  });
});

describe('agentWizardSchema', () => {
  const validWizard = {
    name: 'Treasury Copilot',
    description: 'Monitors Stellar treasury balances and proposes rebalances.',
    ownerDepartment: 'Treasury',
    provider: 'OpenAI' as const,
    model: 'gpt-4o-mini',
    apiKey: 'sk-live-secret-token',
    endpointUrl: 'https://api.openai.com/v1',
    contextWindowTokens: 128_000,
    budget: 5000,
    singleTransactionCap: 1500,
  };

  test('validates multi-step registration payload and blocks invalid caps or API keys', () => {
    assert.equal(agentWizardSchema.safeParse(validWizard).success, true);

    const capOverBudget = agentWizardSchema.safeParse({
      ...validWizard,
      budget: 1000,
      singleTransactionCap: 1500,
    });
    assert.equal(capOverBudget.success, false);
    assert.ok(
      capOverBudget.error.issues.some((issue) => issue.path.includes('singleTransactionCap')),
    );

    const whitespaceApiKey = agentWizardSchema.safeParse({
      ...validWizard,
      apiKey: 'sk-bad key with spaces',
    });
    assert.equal(whitespaceApiKey.success, false);
    assert.ok(whitespaceApiKey.error.issues.some((issue) => issue.path.includes('apiKey')));
  });
});

describe('templateWizardSchema', () => {
  const validTemplateWizard = {
    templateId: 'arbitrageur',
    name: 'DEX Arbitrage Alpha',
    description: 'Executes governed cross-pair Stellar DEX arbitrage.',
    ownerDepartment: 'Trading Operations',
    provider: 'Anthropic' as const,
    model: 'claude-sonnet-4-20250514',
    apiKey: '',
    budget: 10_000,
    singleTransactionCap: 2_000,
    maxHourlyBudgetUsd: 50,
    requireApprovalAbove: undefined,
    allowedNetworks: ['Stellar Mainnet'],
  };

  test('accepts omitted optional approval threshold and rejects invalid policy bounds', () => {
    assert.equal(templateWizardSchema.safeParse(validTemplateWizard).success, true);

    const emptyStringApproval = templateWizardSchema.safeParse({
      ...validTemplateWizard,
      requireApprovalAbove: '',
    });
    assert.equal(emptyStringApproval.success, true);
    if (emptyStringApproval.success) {
      assert.equal(emptyStringApproval.data.requireApprovalAbove, undefined);
    }

    const approvalAboveBudget = templateWizardSchema.safeParse({
      ...validTemplateWizard,
      budget: 5_000,
      requireApprovalAbove: 6_000,
    });
    assert.equal(approvalAboveBudget.success, false);
    assert.ok(
      approvalAboveBudget.error.issues.some((issue) =>
        issue.path.includes('requireApprovalAbove'),
      ),
    );

    const noNetworks = templateWizardSchema.safeParse({
      ...validTemplateWizard,
      allowedNetworks: [],
    });
    assert.equal(noNetworks.success, false);
    assert.ok(noNetworks.error.issues.some((issue) => issue.path.includes('allowedNetworks')));
  });
});

describe('agentProviderConfigSchema & agentConfigPanelSchema', () => {
  test('enforces API key + catalog model for hosted providers and endpoint for self-hosted', () => {
    const hostedMissingKey = agentProviderConfigSchema.safeParse({
      name: 'Production OpenAI',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.5,
      endpointUrl: '',
      apiKey: '',
    });
    assert.equal(hostedMissingKey.success, false);
    assert.ok(hostedMissingKey.error.issues.some((issue) => issue.path.includes('apiKey')));

    const hostedValid = agentProviderConfigSchema.safeParse({
      name: 'Production OpenAI',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.5,
      endpointUrl: '',
      apiKey: 'sk-live-valid-token',
    });
    assert.equal(hostedValid.success, true);

    const ollamaMissingEndpoint = agentProviderConfigSchema.safeParse({
      name: 'Local Ollama',
      provider: 'ollama',
      model: 'llama3.1',
      temperature: 0.3,
      endpointUrl: '',
      apiKey: '',
    });
    assert.equal(ollamaMissingEndpoint.success, false);
    assert.ok(
      ollamaMissingEndpoint.error.issues.some((issue) => issue.path.includes('endpointUrl')),
    );
  });

  test('validates agentConfigPanelSchema prompt, token integer bounds, and model catalog', () => {
    const validPanel = agentConfigPanelSchema.safeParse({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: 'Operate within treasury risk bounds.',
      systemPromptTemplate: '',
    });
    assert.equal(validPanel.success, true);

    const blankPrompt = agentConfigPanelSchema.safeParse({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: '   ',
    });
    assert.equal(blankPrompt.success, false);
    assert.ok(blankPrompt.error.issues.some((issue) => issue.path.includes('systemPrompt')));

    const mismatchedModel = agentConfigPanelSchema.safeParse({
      provider: 'gemini',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: 'Operate within treasury risk bounds.',
    });
    assert.equal(mismatchedModel.success, false);
    assert.ok(mismatchedModel.error.issues.some((issue) => issue.path.includes('model')));
  });
});

describe('agentConfigurationSchema & getFirstValidationMessage', () => {
  test('enforces permission scopes and extracts nested validation messages', () => {
    const missingScopes = agentConfigurationSchema.safeParse({
      name: 'Audit Sentinel',
      description: 'Continuously audits outgoing Stellar transactions.',
      provider: 'OpenAI',
      model: 'gpt-4o',
      endpointUrl: '',
      mode: 'assisted',
      temperature: 0.1,
      monthlyBudget: 1000,
      dailySpendingLimit: 200,
      capabilities: [],
    });
    assert.equal(missingScopes.success, false);
    assert.ok(missingScopes.error.issues.some((issue) => issue.path.includes('capabilities')));

    const extracted = getFirstValidationMessage({
      nested: {
        budget: { message: 'Budget must be greater than 0' },
      },
    });
    assert.equal(extracted, 'Budget must be greater than 0');

    // Cyclic DOM `ref` objects attached by react-hook-form must never cause recursion errors
    const cyclicError: Record<string, unknown> = { message: '' };
    cyclicError.ref = cyclicError;
    cyclicError.self = cyclicError;
    assert.equal(getFirstValidationMessage({ emptyField: cyclicError }), undefined);

    const nanBudget = agentConfigSchema.safeParse({
      name: 'Audit Sentinel',
      provider: 'OpenAI',
      model: 'gpt-4o',
      endpointUrl: '',
      mode: 'assisted',
      temperature: 0.2,
      monthlyBudget: Number.NaN,
    });
    assert.equal(nanBudget.success, false);
    assert.ok(nanBudget.error.issues.some((issue) => issue.path.includes('monthlyBudget')));
  });
});

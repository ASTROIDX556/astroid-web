import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import {
  agentConfigPanelSchema,
  agentConfigSchema,
  agentConfigurationSchema,
  agentProviderConfigSchema,
  agentWizardSchema,
  getFirstValidationMessage,
  templateWizardSchema,
  updateAgentSchema,
} from './schema';

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

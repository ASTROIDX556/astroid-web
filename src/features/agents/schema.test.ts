import { describe, expect, it } from 'vitest';

import {
  AGENT_PROVIDER_IDS,
  PROVIDER_MODELS,
  agentConfigSchema,
  agentWizardSchema,
  requiresEndpoint,
  type AgentConfigFormValues,
} from '@/features/agents/schema';
import {
  agentProviderConfigSchema,
  agentProviderTypes,
} from '@/features/agents/providerConfigSchema';

/** A known-good configuration; individual tests override single fields. */
const validConfig: AgentConfigFormValues = {
  name: 'Treasury Rebalancer',
  description: 'Rebalances the treasury across approved Stellar corridors.',
  provider: 'OpenAI',
  model: 'gpt-4o',
  endpointUrl: '',
  mode: 'assisted',
  temperature: 0.2,
  monthlyBudget: 500,
};

const validWizardConfig = {
  name: 'Treasury Rebalancer',
  description: 'Rebalances the treasury across approved Stellar corridors.',
  ownerDepartment: 'Treasury',
  provider: 'OpenAI' as const,
  model: 'gpt-4o',
  apiKey: 'sk-test-key',
  endpointUrl: '',
  contextWindowTokens: 128_000,
  budget: 5_000,
  singleTransactionCap: 750,
};

describe('agentConfigSchema', () => {
  it('accepts a valid hosted-provider configuration', () => {
    const result = agentConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('trims the agent name and description', () => {
    const result = agentConfigSchema.parse({
      ...validConfig,
      name: '  Treasury Rebalancer  ',
      description: '  Handles rebalancing.  ',
    });
    expect(result.name).toBe('Treasury Rebalancer');
    expect(result.description).toBe('Handles rebalancing.');
  });

  it('rejects a missing or too-short name', () => {
    expect(agentConfigSchema.safeParse({ ...validConfig, name: '' }).success).toBe(false);
    expect(agentConfigSchema.safeParse({ ...validConfig, name: 'A' }).success).toBe(false);
  });

  it('rejects a name longer than 64 characters', () => {
    const result = agentConfigSchema.safeParse({ ...validConfig, name: 'a'.repeat(65) });
    expect(result.success).toBe(false);
  });

  it('allows an omitted description but rejects one over 280 characters', () => {
    expect(agentConfigSchema.safeParse({ ...validConfig, description: '' }).success).toBe(true);
    expect(
      agentConfigSchema.safeParse({ ...validConfig, description: 'a'.repeat(281) }).success,
    ).toBe(false);
  });

  it('accepts every supported provider', () => {
    for (const provider of AGENT_PROVIDER_IDS) {
      const model = PROVIDER_MODELS[provider][0] ?? 'custom-model-v1';
      const endpointUrl = requiresEndpoint(provider) ? 'http://localhost:11434' : '';
      const result = agentConfigSchema.safeParse({
        ...validConfig,
        provider,
        model,
        endpointUrl,
      });
      expect(result.success, `expected provider ${provider} to validate`).toBe(true);
    }
  });

  it('rejects an unknown or empty provider', () => {
    expect(agentConfigSchema.safeParse({ ...validConfig, provider: '' }).success).toBe(false);
    expect(
      agentConfigSchema.safeParse({ ...validConfig, provider: 'UnknownProvider' }).success,
    ).toBe(false);
  });

  it('requires a model', () => {
    expect(agentConfigSchema.safeParse({ ...validConfig, model: '' }).success).toBe(false);
    expect(agentConfigSchema.safeParse({ ...validConfig, model: '   ' }).success).toBe(false);
  });

  it('accepts free-form model ids for the custom provider (empty preset list)', () => {
    expect(PROVIDER_MODELS.Custom).toEqual([]);
    const result = agentConfigSchema.safeParse({
      ...validConfig,
      provider: 'Custom',
      model: 'my-org/finance-agent-v1',
      endpointUrl: 'https://inference.example.com/v1',
    });
    expect(result.success).toBe(true);
  });

  it('keeps temperature within the inclusive 0–2 range', () => {
    for (const temperature of [0, 0.7, 2]) {
      expect(agentConfigSchema.safeParse({ ...validConfig, temperature }).success).toBe(true);
    }
    for (const temperature of [-0.1, 2.1, 10]) {
      expect(agentConfigSchema.safeParse({ ...validConfig, temperature }).success).toBe(false);
    }
  });

  it('rejects a non-numeric temperature', () => {
    const result = agentConfigSchema.safeParse({ ...validConfig, temperature: '0.5' });
    expect(result.success).toBe(false);
  });

  it('requires an endpoint URL for ollama and custom providers', () => {
    for (const provider of ['Ollama', 'Custom'] as const) {
      const result = agentConfigSchema.safeParse({
        ...validConfig,
        provider,
        endpointUrl: '',
      });
      expect(result.success, `expected ${provider} without endpoint to fail`).toBe(false);
      if (result.success) continue;
      expect(result.error.issues.some((issue) => issue.path.includes('endpointUrl'))).toBe(true);
    }
  });

  it('accepts a local endpoint for ollama', () => {
    const result = agentConfigSchema.safeParse({
      ...validConfig,
      provider: 'Ollama',
      model: 'llama3.1:70b',
      endpointUrl: 'http://localhost:11434',
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed custom endpoint URLs', () => {
    for (const endpointUrl of ['not-a-url', 'localhost:11434', 'ftp//missing-colon']) {
      const result = agentConfigSchema.safeParse({
        ...validConfig,
        provider: 'Custom',
        model: 'custom-model',
        endpointUrl,
      });
      expect(result.success, `expected "${endpointUrl}" to fail`).toBe(false);
    }
  });

  it('does not require an endpoint for hosted providers', () => {
    expect(
      agentConfigSchema.safeParse({ ...validConfig, provider: 'Anthropic', endpointUrl: '' })
        .success,
    ).toBe(true);
  });

  it('requires a positive monthly budget within the cap', () => {
    expect(agentConfigSchema.safeParse({ ...validConfig, monthlyBudget: 0 }).success).toBe(false);
    expect(agentConfigSchema.safeParse({ ...validConfig, monthlyBudget: -10 }).success).toBe(false);
    expect(agentConfigSchema.safeParse({ ...validConfig, monthlyBudget: 1 }).success).toBe(true);
    expect(
      agentConfigSchema.safeParse({ ...validConfig, monthlyBudget: 1_000_001 }).success,
    ).toBe(false);
  });

  it('restricts operating mode to assisted or autonomous', () => {
    expect(agentConfigSchema.safeParse({ ...validConfig, mode: 'autonomous' }).success).toBe(true);
    expect(agentConfigSchema.safeParse({ ...validConfig, mode: 'rogue' }).success).toBe(false);
  });
});

describe('agentWizardSchema', () => {
  it('accepts a valid wizard payload', () => {
    expect(agentWizardSchema.safeParse(validWizardConfig).success).toBe(true);
  });

  it('coerces numeric strings for budget and token fields', () => {
    const result = agentWizardSchema.parse({
      ...validWizardConfig,
      budget: '5000',
      singleTransactionCap: '750',
      contextWindowTokens: '128000',
    });
    expect(result.budget).toBe(5_000);
    expect(result.singleTransactionCap).toBe(750);
    expect(result.contextWindowTokens).toBe(128_000);
  });

  it('requires an endpoint for the custom provider', () => {
    const result = agentWizardSchema.safeParse({
      ...validWizardConfig,
      provider: 'Custom',
      model: 'custom-model',
      endpointUrl: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed endpoint URLs', () => {
    expect(
      agentWizardSchema.safeParse({ ...validWizardConfig, endpointUrl: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('rejects an out-of-range context window', () => {
    expect(
      agentWizardSchema.safeParse({ ...validWizardConfig, contextWindowTokens: 0 }).success,
    ).toBe(false);
    expect(
      agentWizardSchema.safeParse({ ...validWizardConfig, contextWindowTokens: 10_000_001 }).success,
    ).toBe(false);
    expect(
      agentWizardSchema.safeParse({ ...validWizardConfig, contextWindowTokens: 1.5 }).success,
    ).toBe(false);
  });

  it('rejects an empty description, department or model', () => {
    expect(agentWizardSchema.safeParse({ ...validWizardConfig, description: '' }).success).toBe(
      false,
    );
    expect(
      agentWizardSchema.safeParse({ ...validWizardConfig, ownerDepartment: '' }).success,
    ).toBe(false);
    expect(agentWizardSchema.safeParse({ ...validWizardConfig, model: '' }).success).toBe(false);
  });

  it('rejects negative budgets and caps', () => {
    expect(agentWizardSchema.safeParse({ ...validWizardConfig, budget: -1 }).success).toBe(false);
    expect(
      agentWizardSchema.safeParse({ ...validWizardConfig, singleTransactionCap: -1 }).success,
    ).toBe(false);
  });
});

describe('agentProviderConfigSchema', () => {
  const prefs = {
    name: 'Inference config',
    provider: 'openai' as const,
    model: 'gpt-4o',
    apiKey: 'sk-test-key',
  };

  it('accepts a valid hosted configuration', () => {
    expect(agentProviderConfigSchema.safeParse(prefs).success).toBe(true);
  });

  it('defaults temperature to 0.7', () => {
    expect(agentProviderConfigSchema.parse(prefs).temperature).toBe(0.7);
  });

  it('requires an API key for hosted providers', () => {
    const result = agentProviderConfigSchema.safeParse({ ...prefs, apiKey: '' });
    expect(result.success).toBe(false);
  });

  it('does not require an API key for local or custom providers', () => {
    expect(
      agentProviderConfigSchema.safeParse({ ...prefs, provider: 'ollama', apiKey: '', endpointUrl: 'http://localhost:11434' })
        .success,
    ).toBe(true);
    expect(
      agentProviderConfigSchema.safeParse({
        ...prefs,
        provider: 'custom',
        apiKey: '',
        endpointUrl: 'https://inference.example.com/v1',
      }).success,
    ).toBe(true);
  });

  it('requires an endpoint for ollama and custom providers', () => {
    for (const provider of agentProviderTypes.filter((type) => type === 'ollama' || type === 'custom')) {
      const result = agentProviderConfigSchema.safeParse({ ...prefs, provider, endpointUrl: '' });
      expect(result.success, `expected ${provider} without endpoint to fail`).toBe(false);
    }
  });

  it('rejects malformed endpoint URLs', () => {
    expect(
      agentProviderConfigSchema.safeParse({ ...prefs, provider: 'custom', endpointUrl: 'nope' })
        .success,
    ).toBe(false);
  });

  it('keeps temperature within 0–2', () => {
    expect(agentProviderConfigSchema.safeParse({ ...prefs, temperature: 2 }).success).toBe(true);
    expect(agentProviderConfigSchema.safeParse({ ...prefs, temperature: 2.1 }).success).toBe(false);
    expect(agentProviderConfigSchema.safeParse({ ...prefs, temperature: -1 }).success).toBe(false);
  });
});

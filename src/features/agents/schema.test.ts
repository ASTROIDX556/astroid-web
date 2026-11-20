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

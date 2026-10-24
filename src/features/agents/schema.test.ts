import assert from 'node:assert/strict';
import test from 'node:test';
import type { ZodIssue } from 'zod';
import { agentConfigSchema } from './schema';

const validConfig = {
  name: 'Treasury agent',
  description: '',
  provider: 'OpenAI' as const,
  model: 'gpt-4o',
  endpointUrl: '',
  mode: 'assisted' as const,
  temperature: 0.2,
  monthlyBudget: 500,
  singleTransactionCap: 100,
  timeoutSeconds: 60,
};

test('rejects a configuration without a model name', () => {
  const result = agentConfigSchema.safeParse({ ...validConfig, model: '' });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0]?.path[0], 'model');
  }
});

test('rejects invalid spending limits', () => {
  const result = agentConfigSchema.safeParse({ ...validConfig, monthlyBudget: 0 });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue: ZodIssue) => issue.path[0] === 'monthlyBudget'));
  }
});

test('rejects a transaction limit above the monthly budget', () => {
  const result = agentConfigSchema.safeParse({ ...validConfig, singleTransactionCap: 600 });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue: ZodIssue) => issue.path[0] === 'singleTransactionCap'));
  }
});

test('rejects invalid timeout values and missing custom endpoints', () => {
  const timeoutResult = agentConfigSchema.safeParse({ ...validConfig, timeoutSeconds: 0 });
  const endpointResult = agentConfigSchema.safeParse({
    ...validConfig,
    provider: 'Custom',
    model: 'my-model',
  });
  const invalidUrlResult = agentConfigSchema.safeParse({
    ...validConfig,
    provider: 'Custom',
    model: 'my-model',
    endpointUrl: 'ftp://example.com',
  });

  assert.equal(timeoutResult.success, false);
  assert.equal(endpointResult.success, false);
  assert.equal(invalidUrlResult.success, false);
  if (!endpointResult.success) {
    assert.ok(endpointResult.error.issues.some((issue: ZodIssue) => issue.path[0] === 'endpointUrl'));
  }
});
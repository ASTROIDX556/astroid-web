import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_PROVIDERS,
  PROVIDER_MODELS,
  agentConfigurationEditorSchema,
  agentConfigSchema,
  agentCreationSchema,
  agentUpdateSchema,
  agentWizardSchema,
  createAgentSchema,
  templateWizardSchema,
  updateAgentSchema,
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

test('agent config schema rejects unsupported provider values', () => {
  for (const provider of ['openai', 'OPENAI', ' Skynet ', 'gpt-4o', null, 42]) {
    const result = agentConfigSchema.safeParse({
      name: 'Treasury agent',
      description: '',
      provider,
      model: 'gpt-4o',
      endpointUrl: '',
      mode: 'assisted',
      temperature: 0.2,
      monthlyBudget: 500,
    });

    assert.equal(result.success, false, String(provider));
    if (!result.success) {
      assert.ok(result.error.issues.some((issue) => issue.path[0] === 'provider'));
    }
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

const VALID_SIGNING_KEY = 'G' + 'A'.repeat(55);
const SECOND_SIGNING_KEY = 'G' + 'B'.repeat(55);

test('editor schema accepts authorized Stellar signing keys', () => {
  const result = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    signingKeys: [VALID_SIGNING_KEY, `  ${SECOND_SIGNING_KEY}  `],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.signingKeys, [VALID_SIGNING_KEY, SECOND_SIGNING_KEY]);
  }
});

test('editor schema rejects malformed signing keys', () => {
  for (const signingKeys of [
    ['not-a-stellar-address'],
    ['S' + 'A'.repeat(55)], // wrong prefix — must be a G-address
    ['G' + 'A'.repeat(54)], // one character short
    ['G' + 'A'.repeat(55).toLowerCase()], // base32 is uppercase only
    [VALID_SIGNING_KEY, ''],
    'GA' + 'A'.repeat(55), // not an array
  ]) {
    const result = agentConfigurationEditorSchema.safeParse({
      ...validEditorConfig,
      signingKeys,
    }) as ParseResult;
    assert.ok(issueFor(result, 'signingKeys'), JSON.stringify(signingKeys));
  }
});

test('editor schema rejects duplicate signing keys', () => {
  const result = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    signingKeys: [VALID_SIGNING_KEY, VALID_SIGNING_KEY],
  }) as ParseResult;

  assert.equal(issueFor(result, 'signingKeys'), 'Signing keys must be unique.');
});

test('editor schema caps the number of authorized signing keys', () => {
  // Eleven unique, well-formed G-addresses (A–K are valid base32 characters).
  const signingKeys = Array.from(
    { length: 11 },
    (_, index) => 'G' + String.fromCharCode(65 + index) + 'A'.repeat(54),
  );

  const result = agentConfigurationEditorSchema.safeParse({
    ...validEditorConfig,
    signingKeys,
  }) as ParseResult;

  assert.ok(issueFor(result, 'signingKeys'));
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
// Agent form schemas — edge cases (#476)
// ---------------------------------------------------------------------------

const validAgentConfig = {
  name: 'Treasury agent',
  description: '',
  provider: 'OpenAI',
  model: 'gpt-4o',
  endpointUrl: '',
  mode: 'assisted',
  temperature: 0.2,
  monthlyBudget: 500,
} as const;

const issuesOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  result.success ? [] : (result.error?.issues ?? []);
const hasIssueOn = (
  result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } },
  field: string,
) => issuesOf(result).some((issue) => issue.path[0] === field);

test('create schema accepts a minimal valid configuration', () => {
  const result = createAgentSchema.safeParse(validAgentConfig);
  assert.equal(result.success, true);
});

test('create schema rejects missing and blank required fields', () => {
  for (const field of ['name', 'provider', 'model', 'mode', 'temperature', 'monthlyBudget'] as const) {
    const payload: Record<string, unknown> = { ...validAgentConfig };
    delete payload[field];
    const result = createAgentSchema.safeParse(payload);
    assert.equal(result.success, false, `missing ${field}`);
    assert.ok(hasIssueOn(result, field), `missing ${field} should flag ${field}`);
  }

  for (const name of ['', '   ', 'x']) {
    const result = createAgentSchema.safeParse({ ...validAgentConfig, name });
    assert.ok(hasIssueOn(result, 'name'), JSON.stringify(name));
  }
});

test('create schema enforces name, model, and description length bounds', () => {
  assert.ok(hasIssueOn(createAgentSchema.safeParse({ ...validAgentConfig, name: 'a'.repeat(65) }), 'name'));
  assert.ok(hasIssueOn(createAgentSchema.safeParse({ ...validAgentConfig, model: 'm'.repeat(121) }), 'model'));
  assert.ok(
    hasIssueOn(
      createAgentSchema.safeParse({ ...validAgentConfig, description: 'd'.repeat(281) }),
      'description',
    ),
  );
});

test('create schema rejects out-of-range budgets, caps, and numeric fields', () => {
  const cases: [string, unknown][] = [
    ['monthlyBudget', 0],
    ['monthlyBudget', -10],
    ['monthlyBudget', 1_000_001],
    ['monthlyBudget', 'not-a-number'],
    ['singleTransactionCap', 0],
    ['singleTransactionCap', 1_000_001],
    ['dailyBudget', -5],
    ['maxSpendPerTransaction', 0],
    ['rateLimitPerMinute', 1.5],
    ['rateLimitPerMinute', 100_001],
    ['tokenThreshold', 999],
    ['tokenThreshold', 10_000_001],
    ['timeoutSeconds', 0],
    ['timeoutSeconds', 601],
    ['timeoutSeconds', 1.5],
  ];
  for (const [field, value] of cases) {
    const result = createAgentSchema.safeParse({ ...validAgentConfig, [field]: value });
    assert.equal(result.success, false, `${field}=${String(value)}`);
    assert.ok(hasIssueOn(result, field), `${field}=${String(value)} should flag ${field}`);
  }
});

test('create schema rejects temperature outside 0-2', () => {
  for (const temperature of [-0.1, 2.1, 'hot']) {
    const result = createAgentSchema.safeParse({ ...validAgentConfig, temperature });
    assert.ok(hasIssueOn(result, 'temperature'), String(temperature));
  }
  for (const temperature of [0, 2]) {
    assert.equal(
      createAgentSchema.safeParse({ ...validAgentConfig, temperature }).success,
      true,
      `boundary ${temperature}`,
    );
  }
});

test('create schema rejects a transaction cap above the monthly budget', () => {
  const result = createAgentSchema.safeParse({
    ...validAgentConfig,
    monthlyBudget: 100,
    singleTransactionCap: 250,
  });
  assert.ok(hasIssueOn(result, 'singleTransactionCap'));

  const equal = createAgentSchema.safeParse({
    ...validAgentConfig,
    monthlyBudget: 100,
    singleTransactionCap: 100,
  });
  assert.equal(equal.success, true);
});

test('create schema enforces endpoint rules per provider', () => {
  // Hosted providers accept an empty endpoint.
  assert.equal(createAgentSchema.safeParse(validAgentConfig).success, true);

  // Self-hosted providers require a valid http(s) endpoint and a catalog model.
  for (const [provider, model] of [
    ['Ollama', 'llama3.1:70b'],
    ['Custom', 'my-org/finance-agent-v1'],
  ] as const) {
    const missing = createAgentSchema.safeParse({
      ...validAgentConfig,
      provider,
      model,
      endpointUrl: '',
    });
    assert.ok(hasIssueOn(missing, 'endpointUrl'), provider);

    const badScheme = createAgentSchema.safeParse({
      ...validAgentConfig,
      provider,
      model,
      endpointUrl: 'javascript:alert(1)',
    });
    assert.ok(hasIssueOn(badScheme, 'endpointUrl'), provider);

    const ok = createAgentSchema.safeParse({
      ...validAgentConfig,
      provider,
      model,
      endpointUrl: 'https://models.internal/v1',
    });
    assert.equal(ok.success, true, provider);
  }
});

test('update schema rejects an empty patch but accepts partial updates', () => {
  const empty = updateAgentSchema.safeParse({});
  assert.equal(empty.success, false);

  const partial = updateAgentSchema.safeParse({ monthlyBudget: 250 });
  assert.equal(partial.success, true);

  const invalidField = updateAgentSchema.safeParse({ temperature: 5 });
  assert.ok(hasIssueOn(invalidField, 'temperature'));

  // Switching to a self-hosted provider still requires an endpoint.
  const providerSwitch = updateAgentSchema.safeParse({ provider: 'Ollama' });
  assert.ok(hasIssueOn(providerSwitch, 'endpointUrl'));
});

test('wizard schema enforces description, department, and coerced budgets', () => {
  const validWizard = {
    name: 'Treasury agent',
    description: 'Watches treasury inflows and flags anomalies.',
    ownerDepartment: 'Finance',
    provider: 'OpenAI',
    model: 'gpt-4o',
    apiKey: '',
    endpointUrl: '',
    budget: '5000',
    singleTransactionCap: '500',
  };
  assert.equal(agentWizardSchema.safeParse(validWizard).success, true);

  for (const [field, value] of [
    ['description', 'too short'],
    ['description', 'd'.repeat(501)],
    ['ownerDepartment', 'F'],
    ['budget', '0'],
    ['budget', '-100'],
    ['budget', '100000001'],
    ['budget', 'abc'],
    ['singleTransactionCap', '0'],
    ['singleTransactionCap', '20000000'],
  ] as const) {
    const result = agentWizardSchema.safeParse({ ...validWizard, [field]: value });
    assert.equal(result.success, false, `${field}=${value}`);
    assert.ok(hasIssueOn(result, field), `${field}=${value} should flag ${field}`);
  }
});

test('wizard schema rejects a cap above budget and malformed API keys', () => {
  const base = {
    name: 'Treasury agent',
    description: 'Watches treasury inflows and flags anomalies.',
    ownerDepartment: 'Finance',
    provider: 'OpenAI',
    model: 'gpt-4o',
    apiKey: '',
    endpointUrl: '',
    budget: 1000,
    singleTransactionCap: 2000,
  };
  assert.ok(hasIssueOn(agentWizardSchema.safeParse(base), 'singleTransactionCap'));

  for (const apiKey of ['has spaces', 'key\nwith\ttabs']) {
    const result = agentWizardSchema.safeParse({ ...base, singleTransactionCap: 500, apiKey });
    assert.ok(hasIssueOn(result, 'apiKey'), JSON.stringify(apiKey));
  }
});

test('template wizard schema enforces name charset, networks, and policy bounds', () => {
  const validTemplate = {
    templateId: 'treasury-monitor',
    name: 'Treasury Monitor',
    description: 'Monitors treasury wallet activity.',
    ownerDepartment: 'Finance',
    provider: 'OpenAI',
    model: 'gpt-4o',
    apiKey: '',
    budget: 5000,
    singleTransactionCap: 500,
    maxHourlyBudgetUsd: 100,
    requireApprovalAbove: 50,
    allowedNetworks: ['testnet'],
  };
  assert.equal(templateWizardSchema.safeParse(validTemplate).success, true);

  for (const [field, value] of [
    ['templateId', ''],
    ['name', 'bad/name!'],
    ['name', 'x'.repeat(41)],
    ['allowedNetworks', []],
    ['maxHourlyBudgetUsd', 0],
    ['maxHourlyBudgetUsd', 10001],
    ['requireApprovalAbove', -1],
    ['budget', 0],
    ['singleTransactionCap', 6000],
  ] as const) {
    const result = templateWizardSchema.safeParse({ ...validTemplate, [field]: value });
    assert.equal(result.success, false, `${field}=${JSON.stringify(value)}`);
    assert.ok(hasIssueOn(result, field), `${field} should flag ${field}`);
  }
});

test('provider settings schema enforces hosted keys, endpoints, and catalog models', () => {
  const validProvider = {
    name: 'Treasury config',
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    endpointUrl: '',
    apiKey: 'sk-' + 'a'.repeat(30),
  };
  assert.equal(agentProviderConfigSchema.safeParse(validProvider).success, true);

  // Hosted providers require a well-formed API key.
  for (const apiKey of ['', 'not-a-real-key', 'sk-short']) {
    const result = agentProviderConfigSchema.safeParse({ ...validProvider, apiKey });
    assert.ok(hasIssueOn(result, 'apiKey'), JSON.stringify(apiKey));
  }

  // A model outside the provider catalog is rejected.
  assert.ok(
    hasIssueOn(
      agentProviderConfigSchema.safeParse({ ...validProvider, model: 'llama3.1' }),
      'model',
    ),
  );

  // Self-hosted providers require an http(s) endpoint instead of a key.
  assert.ok(
    hasIssueOn(
      agentProviderConfigSchema.safeParse({
        ...validProvider,
        provider: 'ollama',
        model: 'llama3.1',
        apiKey: '',
        endpointUrl: '',
      }),
      'endpointUrl',
    ),
  );

  const ollama = agentProviderConfigSchema.safeParse({
    ...validProvider,
    provider: 'ollama',
    model: 'llama3.1',
    apiKey: '',
    endpointUrl: 'http://localhost:11434',
  });
  assert.equal(ollama.success, true);
});

test('agent update schema rejects bad provider ids and out-of-range values', () => {
  for (const provider of ['OpenAI', 'OPENAI', 'skynet', '', 7]) {
    const result = agentUpdateSchema.safeParse({ provider });
    assert.equal(result.success, false, String(provider));
    assert.ok(hasIssueOn(result, 'provider'), String(provider));
  }

  assert.ok(hasIssueOn(agentUpdateSchema.safeParse({ name: '   ' }), 'name'));
  assert.ok(hasIssueOn(agentUpdateSchema.safeParse({ name: 'n'.repeat(81) }), 'name'));
  assert.ok(hasIssueOn(agentUpdateSchema.safeParse({ model: 'm'.repeat(121) }), 'model'));
  assert.ok(hasIssueOn(agentUpdateSchema.safeParse({ endpointUrl: 'ftp://x' }), 'endpointUrl'));
  assert.ok(hasIssueOn(agentUpdateSchema.safeParse({ apiKey: 'has space' }), 'apiKey'));

  const valid = agentUpdateSchema.safeParse({
    name: 'Treasury config',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    temperature: 0.7,
    apiKey: 'gemini-key',
  });
  assert.equal(valid.success, true);
});

test('agent creation form schema coerces numerics and rejects bad values', () => {
  const validCreation = {
    name: 'Ops agent',
    provider: 'openai',
    model: 'gpt-4o',
    tokenLimit: '50000',
    spendingThreshold: '250',
  };
  const result = agentCreationSchema.safeParse(validCreation);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.tokenLimit, 50_000);
    assert.equal(result.data.spendingThreshold, 250);
  }

  for (const [field, value] of [
    ['provider', 'gemini'],
    ['tokenLimit', '0'],
    ['tokenLimit', '-5'],
    ['tokenLimit', '1.5'],
    ['spendingThreshold', '-1'],
    ['name', 'x'],
  ] as const) {
    const parsed = agentCreationSchema.safeParse({ ...validCreation, [field]: value });
    assert.equal(parsed.success, false, `${field}=${value}`);
  }
});

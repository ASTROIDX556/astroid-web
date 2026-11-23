import type { AgentProviderId } from './schema';

/**
 * A provider preset is pure configuration data: the recommended default
 * model, API endpoint, context window, and suggested spend guardrails for
 * one supported inference provider. Preset definitions are kept separate
 * from form state mutations — consumers (the agent creation wizard) decide
 * how to apply them. The two guide fields are never applied automatically;
 * they are surfaced on the preset card as recommendations to type into the
 * wizard's validated budget fields.
 */
export interface AgentProviderPreset {
  id: AgentProviderId;
  /** Display name shown on the preset card. */
  label: string;
  /** One-line description of what the provider is / where it runs. */
  tagline: string;
  /**
   * Recommended default model, taken from the provider catalog in
   * `PROVIDER_MODELS`. Empty for `Custom` — the operator names their own
   * deployment.
   */
  defaultModel: string;
  /**
   * Recommended API endpoint. Empty for `Custom` — the wizard's validation
   * then requires the operator to enter a properly formatted URL.
   */
  endpointUrl: string;
  /** Recommended context window in tokens for the default model. */
  contextWindowTokens: number;
  /**
   * Suggested monthly spend budget (USDC) for this provider, shown as
   * guidance on the preset card. `0` means no metered per-call API spend
   * (self-hosted runtimes). Not applied to the form — the wizard's Zod
   * budget validation stays authoritative over the entered value.
   */
  monthlyBudgetGuideUsdc: number;
  /**
   * Suggested per-transaction spend cap (USDC), shown as guidance on the
   * preset card. `0` means the preset suggests no automatic cap.
   */
  singleTxnCapGuideUsdc: number;
}

/**
 * Supported inference providers with sensible provisioning defaults
 * (Nvidia NIM, OpenAI, Anthropic, Gemini, Ollama, plus a custom endpoint).
 */
export const AGENT_PROVIDER_PRESETS: readonly AgentProviderPreset[] = [
  {
    id: 'Nvidia',
    label: 'Nvidia NIM',
    tagline: 'NIM microservices on the NVIDIA API catalog.',
    defaultModel: 'meta/llama-3.1-405b-instruct',
    endpointUrl: 'https://integrate.api.nvidia.com/v1',
    contextWindowTokens: 131_072,
    monthlyBudgetGuideUsdc: 200,
    singleTxnCapGuideUsdc: 25,
  },
  {
    id: 'OpenAI',
    label: 'OpenAI',
    tagline: 'Hosted OpenAI chat-completions API.',
    defaultModel: 'gpt-4o-mini',
    endpointUrl: 'https://api.openai.com/v1',
    contextWindowTokens: 128_000,
    monthlyBudgetGuideUsdc: 100,
    singleTxnCapGuideUsdc: 15,
  },
  {
    id: 'Anthropic',
    label: 'Anthropic',
    tagline: 'Claude models via the Anthropic Messages API.',
    defaultModel: 'claude-3-5-sonnet-latest',
    endpointUrl: 'https://api.anthropic.com/v1',
    contextWindowTokens: 200_000,
    monthlyBudgetGuideUsdc: 200,
    singleTxnCapGuideUsdc: 30,
  },
  {
    id: 'Gemini',
    label: 'Google Gemini',
    tagline: 'Gemini models via Google Vertex AI / AI Studio.',
    defaultModel: 'gemini-1.5-pro',
    endpointUrl: 'https://generativelanguage.googleapis.com/v1',
    contextWindowTokens: 1_000_000,
    monthlyBudgetGuideUsdc: 150,
    singleTxnCapGuideUsdc: 20,
  },
  {
    id: 'Ollama',
    label: 'Ollama (self-hosted)',
    tagline: 'Local or private Ollama runtime.',
    defaultModel: 'llama3.1:70b',
    endpointUrl: 'http://localhost:11434',
    contextWindowTokens: 128_000,
    monthlyBudgetGuideUsdc: 0,
    singleTxnCapGuideUsdc: 0,
  },
  {
    id: 'Custom',
    label: 'Custom endpoint',
    tagline: 'Any OpenAI-compatible inference server.',
    defaultModel: '',
    endpointUrl: '',
    contextWindowTokens: 32_768,
    monthlyBudgetGuideUsdc: 100,
    singleTxnCapGuideUsdc: 10,
  },
] as const;

export function getProviderPreset(id: AgentProviderId): AgentProviderPreset | undefined {
  return AGENT_PROVIDER_PRESETS.find((preset) => preset.id === id);
}

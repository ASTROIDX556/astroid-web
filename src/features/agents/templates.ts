import type { AgentWizardValues } from './schema';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  /** Pre-filled configuration values applied when this template is selected. */
  defaults: Partial<AgentWizardValues>;
  /** Maximum hourly budget cap for this template type. */
  maxHourlyBudgetUsd: number;
}

/**
 * Pre-defined agent templates that simplify setup by auto-populating
 * configuration values for common autonomous agent use-cases.
 */
export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'arbitrageur',
    name: 'Arbitrageur',
    description:
      'Scans Stellar DEX order books for spread opportunities and executes cross-pair arbitrage trades automatically.',
    icon: '📈',
    category: 'Trading',
    defaults: {
      provider: 'Anthropic',
      model: 'claude-sonnet-4-20250514',
      description:
        'Scans Stellar DEX order books for spread opportunities and executes cross-pair arbitrage trades automatically.',
      budget: 10000,
      singleTransactionCap: 2000,
      ownerDepartment: 'Trading Operations',
    },
    maxHourlyBudgetUsd: 50,
  },
  {
    id: 'liquidity-provider',
    name: 'Liquidity Provider',
    description:
      'Manages concentrated liquidity positions across Stellar AMM pools and rebalances based on volume trends.',
    icon: '💧',
    category: 'DeFi',
    defaults: {
      provider: 'Anthropic',
      model: 'claude-sonnet-4-20250514',
      description:
        'Manages concentrated liquidity positions across Stellar AMM pools and rebalances based on volume trends.',
      budget: 25000,
      singleTransactionCap: 5000,
      ownerDepartment: 'DeFi Strategy',
    },
    maxHourlyBudgetUsd: 100,
  },
  {
    id: 'treasury-allocator',
    name: 'Treasury Allocator',
    description:
      'Rebalances organizational treasury across stablecoins and XLM based on policy constraints and market signals.',
    icon: '🏦',
    category: 'Treasury',
    defaults: {
      provider: 'Anthropic',
      model: 'claude-sonnet-4-20250514',
      description:
        'Rebalances organizational treasury across stablecoins and XLM based on policy constraints and market signals.',
      budget: 50000,
      singleTransactionCap: 10000,
      ownerDepartment: 'Finance Operations',
    },
    maxHourlyBudgetUsd: 200,
  },
  {
    id: 'yield-optimizer',
    name: 'Yield Optimizer',
    description:
      'Monitors DeFi yield opportunities on Stellar and moves capital to highest-yielding strategies within risk limits.',
    icon: '🌾',
    category: 'DeFi',
    defaults: {
      provider: 'Ollama',
      model: 'llama3.1:8b',
      description:
        'Monitors DeFi yield opportunities on Stellar and moves capital to highest-yielding strategies within risk limits.',
      budget: 15000,
      singleTransactionCap: 3000,
      ownerDepartment: 'DeFi Strategy',
    },
    maxHourlyBudgetUsd: 75,
  },
  {
    id: 'compliance-monitor',
    name: 'Compliance Monitor',
    description:
      'Screens all outgoing transactions against compliance rulesets and flags suspicious patterns for review.',
    icon: '🛡️',
    category: 'Compliance',
    defaults: {
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      description:
        'Screens all outgoing transactions against compliance rulesets and flags suspicious patterns for review.',
      budget: 5000,
      singleTransactionCap: 500,
      ownerDepartment: 'Compliance',
    },
    maxHourlyBudgetUsd: 25,
  },
  {
    id: 'payment-scheduler',
    name: 'Payment Scheduler',
    description:
      'Automates recurring payment streams and salary disbursements using Stellar payment channels.',
    icon: '⏱️',
    category: 'Payments',
    defaults: {
      provider: 'Ollama',
      model: 'llama3.1:8b',
      description:
        'Automates recurring payment streams and salary disbursements using Stellar payment channels.',
      budget: 20000,
      singleTransactionCap: 4000,
      ownerDepartment: 'Finance Operations',
    },
    maxHourlyBudgetUsd: 150,
  },
];

export function getTemplateById(id: string): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.id === id);
}

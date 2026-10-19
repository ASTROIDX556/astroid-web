import {
  AlertTriangle,
  FileCheck2,
  Gauge,
  ShieldAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface FinancialBriefingPrompt {
  id: string;
  /** Short chip label shown in the quick-action bar. */
  label: string;
  /** Full prompt injected into the assistant composer. */
  prompt: string;
  icon: LucideIcon;
}

/**
 * Curated financial-briefing commands for the Nvidia NIM assistant. These are
 * deliberately operator-focused (spend, balances, approvals, budgets and
 * policy risk) so the most common governance questions are one click away.
 */
export const FINANCIAL_BRIEFING_PROMPTS: readonly FinancialBriefingPrompt[] = [
  {
    id: 'agent-spend',
    label: "Summarize today's agent spend",
    prompt:
      "Summarize today's agent spend, broken down by agent and budget envelope, and flag anything unusual.",
    icon: Zap,
  },
  {
    id: 'low-balance',
    label: 'Check low balance wallets',
    prompt:
      'Check every agent wallet for low balances or minimum reserve thresholds and recommend any top-ups.',
    icon: AlertTriangle,
  },
  {
    id: 'pending-proposals',
    label: 'Review pending proposals',
    prompt:
      'Review pending proposals, flag anything time-sensitive, and recommend whether to approve or reject each one.',
    icon: FileCheck2,
  },
  {
    id: 'budget-risk',
    label: 'Flag budget risks',
    prompt:
      'Flag budgets that are nearing or over their limits and suggest reallocations before the period resets.',
    icon: Gauge,
  },
  {
    id: 'policy-violations',
    label: 'Summarize policy violations',
    prompt:
      'Summarize recent policy violations and risky transactions that need operator review, with recommended next steps.',
    icon: ShieldAlert,
  },
];

/**
 * Financial briefing templates for the Nvidia NIM AI assistant chat interface.
 *
 * Data catalogue only — no chat state, no submission logic. The selector
 * component renders these and the chat view decides what to do with the
 * chosen template (see `BriefingTemplateSelector` and
 * `NvidiaAssistantWidget.handleTemplateSelect`).
 */

export interface FinancialBriefingTemplate {
  id: string;
  /** Short display name shown in the template selector menu. */
  label: string;
  /** Full prompt auto-populated into the composer and dispatched on selection. */
  prompt: string;
  /** One-line intent shown beside the label in the selector. */
  description: string;
  /** Lucide icon registry key resolved by the selector component. */
  iconName: string;
}

export const FINANCIAL_BRIEFING_TEMPLATES: FinancialBriefingTemplate[] = [
  {
    id: 'tpl-today-expenditure',
    label: "Summarize today's agent expenditure",
    prompt:
      "Summarize today's agent expenditure: total spend per agent and per department, and flag any agent over its daily budget.",
    description: 'Per-agent spend totals for the current day.',
    iconName: 'Zap',
  },
  {
    id: 'tpl-audit-proposals',
    label: 'Audit pending transaction proposals',
    prompt:
      'Audit pending transaction proposals: list every unapproved on-chain proposal, its requesting agent, amount, and risk flags.',
    description: 'Review unapproved on-chain proposals and risk flags.',
    iconName: 'ScrollText',
  },
  {
    id: 'tpl-treasury-health',
    label: 'Check treasury health',
    prompt:
      'Check treasury health: aggregate balance across agent wallets, low-balance warnings, and runway at the current burn rate.',
    description: 'Balances, low-balance warnings, and burn-rate runway.',
    iconName: 'Landmark',
  },
];

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  /** True while the assistant response is still streaming word-by-word. */
  isPartial?: boolean;
  structuredBriefing?: {
    totalDailySpend: number;
    currency: string;
    activeAgentsCount: number;
    lowBalanceWalletsCount: number;
    topSpenderAgent: string;
    recommendation: string;
  };
}

export interface QuickPromptChip {
  id: string;
  label: string;
  promptText: string;
  iconName: string;
}

/** Parsed action card extracted from [ACTION: ...] markers in assistant text. */
export interface ActionCard {
  type: string;
  label: string;
  /** Original raw marker string for display. */
  raw: string;
}

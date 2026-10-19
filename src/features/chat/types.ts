export type MessageRole = 'user' | 'assistant' | 'system';

/** Delivery lifecycle for a message bubble. */
export type MessageStatus = 'sending' | 'sent' | 'streaming' | 'complete' | 'error';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  status?: MessageStatus;
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

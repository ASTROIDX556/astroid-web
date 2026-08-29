export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
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

export type MessageRole = 'user' | 'assistant' | 'system';

export type IconName = 'sparkles' | 'chart' | 'wallet' | 'activity' | 'settings';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  error?: string;
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
  iconName: IconName;
}

export interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  quickPrompts?: QuickPromptChip[];
  onSendMessage: (message: string) => void;
}

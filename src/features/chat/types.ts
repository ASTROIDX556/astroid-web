import type { FinancialBriefingData } from '@/components/chat/FinancialBriefingCard';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  structuredBriefing?: FinancialBriefingData;
}

export interface QuickPromptChip {
  id: string;
  label: string;
  promptText: string;
  iconName: string;
}

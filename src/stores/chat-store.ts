import { create } from 'zustand';

import type { ChatMessage } from '@/features/chat/types';

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  hasError: boolean;
  appendMessage: (message: ChatMessage) => void;
  setTyping: (value: boolean) => void;
  setError: (value: boolean) => void;
  reset: (messages: ChatMessage[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isTyping: false,
  hasError: false,
  appendMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setTyping: (value) => set({ isTyping: value }),
  setError: (value) => set({ hasError: value }),
  reset: (messages) => set({ messages, isTyping: false, hasError: false }),
}));

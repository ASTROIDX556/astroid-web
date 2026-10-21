import { create } from 'zustand';

interface CommandPaletteState {
  open: boolean;
  setOpen: (value: boolean) => void;
  toggle: () => void;
}

/** Global command-palette (cmdk) open state, bound to ⌘K / Ctrl+K. */
export const useCommandStore = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (value) => set({ open: value }),
  toggle: () => set((s) => ({ open: !s.open })),
}));

interface AssistantState {
  open: boolean;
  pendingPrompt: string | null;
  openWithPrompt: (prompt: string) => void;
  setOpen: (value: boolean) => void;
  toggle: () => void;
}

/** Floating AI assistant drawer state (also embedded on the dashboard). */
export const useAssistantStore = create<AssistantState>((set) => ({
  open: false,
  pendingPrompt: null,
  openWithPrompt: (prompt) => set({ open: true, pendingPrompt: prompt }),
  setOpen: (value) => set({ open: value }),
  toggle: () => set((s) => ({ open: !s.open })),
}));

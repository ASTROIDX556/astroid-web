import { create } from 'zustand';

interface CommandPaletteState {
  open: boolean;
  returnFocusTarget: HTMLElement | null;
  setOpen: (value: boolean) => void;
  toggle: () => void;
}

function getFocusedElement(): HTMLElement | null {
  return typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
}

/** Global command-palette (cmdk) open state, bound to ⌘K / Ctrl+K. */
export const useCommandStore = create<CommandPaletteState>((set) => ({
  open: false,
  returnFocusTarget: null,
  setOpen: (value) => set((state) => value
    ? { open: true, returnFocusTarget: getFocusedElement() }
    : { open: false, returnFocusTarget: state.returnFocusTarget }),
  toggle: () => set((state) => state.open
    ? { open: false, returnFocusTarget: state.returnFocusTarget }
    : { open: true, returnFocusTarget: getFocusedElement() }),
}));

interface AssistantState {
  open: boolean;
  setOpen: (value: boolean) => void;
  toggle: () => void;
}

/** Floating AI assistant drawer state (also embedded on the dashboard). */
export const useAssistantStore = create<AssistantState>((set) => ({
  open: false,
  setOpen: (value) => set({ open: value }),
  toggle: () => set((s) => ({ open: !s.open })),
}));

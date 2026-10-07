import { create } from 'zustand';
import {
  getDocumentThemeCookie,
  readThemeCookie,
  setThemeCookie,
  type ThemeMode,
} from '@/lib/theme-cookie';

interface ThemeState {
  mode: ThemeMode;
  highContrast: boolean;
  reducedMotion: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleContrast: () => void;
  toggleReducedMotion: () => void;
}

const initialThemeMode = readThemeCookie(
  typeof document !== 'undefined' ? getDocumentThemeCookie() : 'light',
);

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialThemeMode,
  highContrast: false,
  reducedMotion: false,
  setMode: (mode) => {
    set({ mode });
    setThemeCookie(mode);
  },
  toggleContrast: () => set((s) => ({ highContrast: !s.highContrast })),
  toggleReducedMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),
}));

export type { ThemeMode };

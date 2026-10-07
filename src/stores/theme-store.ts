import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: initialThemeMode,
      highContrast: false,
      reducedMotion: false,
      setMode: (mode) => {
        set({ mode });
        setThemeCookie(mode);
      },
      toggleContrast: () => set((s) => ({ highContrast: !s.highContrast })),
      toggleReducedMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),
    }),
    {
      name: 'astroid-theme-preferences',
      partialize: (state) => ({
        mode: state.mode,
        highContrast: state.highContrast,
        reducedMotion: state.reducedMotion,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) setThemeCookie(state.mode);
      },
    },
  ),
);

export type { ThemeMode };

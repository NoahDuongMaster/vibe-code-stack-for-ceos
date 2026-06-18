'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'light' | 'dark';

type ColorModeStore = {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
};

export const useColorModeStore = create<ColorModeStore>()(
  persist(
    (set) => ({
      colorMode: 'light',
      setColorMode: (colorMode) => set({ colorMode }),
      toggleColorMode: () =>
        set((s) => ({ colorMode: s.colorMode === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'color-mode' },
  ),
);

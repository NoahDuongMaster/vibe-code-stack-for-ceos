import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

type UiState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'admin-ui',
      storage: createJSONStorage(() => localStorage),
      // Applies the persisted (or default) theme to the DOM as soon as
      // rehydration completes — without this, a dark-mode user resets to
      // light on every reload since `applyTheme` only ran from `setTheme`.
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

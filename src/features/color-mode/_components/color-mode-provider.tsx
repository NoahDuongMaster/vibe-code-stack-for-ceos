'use client';
import { useEffect } from 'react';
import { useColorModeStore } from '@/features/color-mode/store';

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const { colorMode } = useColorModeStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(colorMode);
  }, [colorMode]);

  return <>{children}</>;
}

// Inline script injected in <head> before React hydrates — prevents flash of wrong theme
export const colorModeScript = `
  try {
    const s = localStorage.getItem('color-mode')
    const mode = s ? JSON.parse(s)?.state?.colorMode : null
    document.documentElement.classList.add(mode === 'dark' ? 'dark' : 'light')
  } catch {}
`;

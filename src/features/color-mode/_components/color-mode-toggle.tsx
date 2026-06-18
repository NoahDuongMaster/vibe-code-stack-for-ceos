'use client';
import { Moon, Sun } from 'lucide-react';
import { useColorModeStore } from '@/features/color-mode/store';

export function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorModeStore();

  return (
    <button
      type="button"
      onClick={toggleColorMode}
      aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
      className="inline-flex items-center justify-center rounded-md border bg-background p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {colorMode === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

'use client';
import { Moon, Sun } from 'lucide-react';
import { useColorModeStore } from '@/features/color-mode/store';
import { css } from '@/styled-system/css';

export function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorModeStore();

  return (
    <button
      type="button"
      onClick={toggleColorMode}
      aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        rounded: 'md',
        borderWidth: '1px',
        bg: 'background',
        p: '2',
        color: 'muted.foreground',
        cursor: 'pointer',
        transition: 'colors',
        _hover: { bg: 'accent', color: 'accent.foreground' },
      })}
    >
      {colorMode === 'dark' ? (
        <Sun className={css({ h: '4', w: '4' })} />
      ) : (
        <Moon className={css({ h: '4', w: '4' })} />
      )}
    </button>
  );
}

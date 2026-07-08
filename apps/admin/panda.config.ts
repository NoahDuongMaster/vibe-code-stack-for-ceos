import { defineConfig } from '@pandacss/dev';

// Shared design system — mirrors apps/dapp's tokens so the admin panel and the
// web app speak the same visual language. Dark mode differs by host: dapp
// toggles a `.dark` class, admin toggles `[data-theme=dark]` (see below).
export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'src/styled-system',

  conditions: {
    extend: {
      dark: '[data-theme=dark] &',
      open: '&[data-state=open]',
      closed: '&[data-state=closed]',
      checked: '&:is([data-state=checked], [aria-checked=true])',
      unchecked: '&[data-state=unchecked]',
      highlighted: '&[data-highlighted]',
      selected: '&[data-selected]',
      invalid: '&:is([data-invalid], [aria-invalid=true])',
    },
  },

  theme: {
    extend: {
      tokens: {
        fonts: {
          sans: {
            value:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          },
          mono: {
            value:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          },
        },
        radii: {
          sm: { value: '0.375rem' },
          md: { value: '0.5rem' },
          lg: { value: '0.625rem' },
          xl: { value: '0.875rem' },
        },
      },
      semanticTokens: {
        colors: {
          background: {
            value: { base: 'oklch(1 0 0)', _dark: 'oklch(0.145 0 0)' },
          },
          foreground: {
            value: { base: 'oklch(0.145 0 0)', _dark: 'oklch(0.985 0 0)' },
          },
          card: {
            DEFAULT: {
              value: { base: 'oklch(1 0 0)', _dark: 'oklch(0.205 0 0)' },
            },
            foreground: {
              value: { base: 'oklch(0.145 0 0)', _dark: 'oklch(0.985 0 0)' },
            },
          },
          primary: {
            DEFAULT: {
              value: { base: 'oklch(0.205 0 0)', _dark: 'oklch(0.922 0 0)' },
            },
            foreground: {
              value: { base: 'oklch(0.985 0 0)', _dark: 'oklch(0.205 0 0)' },
            },
          },
          secondary: {
            DEFAULT: {
              value: { base: 'oklch(0.97 0 0)', _dark: 'oklch(0.269 0 0)' },
            },
            foreground: {
              value: { base: 'oklch(0.205 0 0)', _dark: 'oklch(0.985 0 0)' },
            },
          },
          muted: {
            DEFAULT: {
              value: { base: 'oklch(0.97 0 0)', _dark: 'oklch(0.269 0 0)' },
            },
            foreground: {
              value: { base: 'oklch(0.556 0 0)', _dark: 'oklch(0.708 0 0)' },
            },
          },
          accent: {
            DEFAULT: {
              value: { base: 'oklch(0.97 0 0)', _dark: 'oklch(0.269 0 0)' },
            },
            foreground: {
              value: { base: 'oklch(0.205 0 0)', _dark: 'oklch(0.985 0 0)' },
            },
          },
          destructive: {
            DEFAULT: {
              value: {
                base: 'oklch(0.577 0.245 27.325)',
                _dark: 'oklch(0.704 0.191 22.216)',
              },
            },
          },
          success: {
            value: {
              base: 'oklch(0.6 0.15 160)',
              _dark: 'oklch(0.7 0.15 160)',
            },
          },
          border: {
            value: { base: 'oklch(0.922 0 0)', _dark: 'oklch(1 0 0 / 10%)' },
          },
          input: {
            value: { base: 'oklch(0.922 0 0)', _dark: 'oklch(1 0 0 / 15%)' },
          },
          ring: {
            value: { base: 'oklch(0.708 0 0)', _dark: 'oklch(0.556 0 0)' },
          },
        },
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
    },
  },

  globalCss: {
    '*, *::before, *::after': {
      borderColor: 'border',
    },
    body: {
      bg: 'background',
      color: 'foreground',
      fontFamily: 'sans',
      minHeight: '100vh',
      fontSmoothing: 'antialiased',
    },
  },
});

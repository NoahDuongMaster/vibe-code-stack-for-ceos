import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'src/styled-system',

  conditions: {
    extend: {
      dark: '.dark &',
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
            value: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
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
          popover: {
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
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        zoomIn: {
          from: { transform: 'scale(0.95)' },
          to: { transform: 'scale(1)' },
        },
        zoomOut: {
          from: { transform: 'scale(1)' },
          to: { transform: 'scale(0.95)' },
        },
        pulse: {
          '50%': { opacity: '0.5' },
        },
        accordionDown: {
          from: { height: '0' },
          to: { height: 'var(--height)' },
        },
        accordionUp: {
          from: { height: 'var(--height)' },
          to: { height: '0' },
        },
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

import { vi } from 'vitest';

// jsdom does not implement matchMedia. Components that read responsive state
// (Panda CSS / Ark UI) call it during render, so polyfill a no-op matcher.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated, kept for older libs
    removeListener: vi.fn(), // deprecated, kept for older libs
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

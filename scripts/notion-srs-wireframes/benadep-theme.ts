export const BENADEP_THEME = Object.freeze({
  primary: '#E9486A',
  primaryLight: '#F67993',
  deepPlum: '#A21C38',
  page: '#FFF9F8',
  card: '#FFFDFB',
  radius: 10,
  spacingUnit: 8,
});

type TThemeSource = Readonly<{
  path: string;
  token: string;
}>;

const COLOR_SOURCE =
  '/Users/truongdn/Desktop/benadep/packages/design-system/src/tokens/colors.css';
const SPEC_SOURCE =
  'docs/superpowers/specs/2026-07-18-notion-srs-ui-wireframes-mockups-design.md';

export const BENADEP_THEME_SOURCES = Object.freeze({
  primary: Object.freeze({ path: COLOR_SOURCE, token: '--primary' }),
  primaryLight: Object.freeze({
    path: COLOR_SOURCE,
    token: '--primary-light',
  }),
  deepPlum: Object.freeze({ path: COLOR_SOURCE, token: '--accent' }),
  page: Object.freeze({ path: COLOR_SOURCE, token: '--brand-cream-50' }),
  card: Object.freeze({ path: COLOR_SOURCE, token: '--card' }),
  radius: Object.freeze({ path: COLOR_SOURCE, token: '--radius' }),
  spacingUnit: Object.freeze({
    path: SPEC_SOURCE,
    token: 'Benadep visual tokens · Spacing: grid 8px',
  }),
} satisfies Readonly<Record<keyof typeof BENADEP_THEME, TThemeSource>>);

export const BENADEP_RENDER_TOKENS = Object.freeze({
  ink: '#1D1018',
  heading: '#2F2B33',
  body: '#5F5A63',
  muted: '#64748B',
  neutral: '#F6F8FC',
  softBlush: '#F6E7E4',
  border: '#E2E8F0',
  borderStrong: '#826C70',
  focus: '#8F676E',
  destructive: '#C0392B',
  success: '#109B76',
  successLight: '#D9F6E8',
  errorLight: '#FFE8E8',
  warningLight: '#FFF2D4',
  white: '#FFFFFF',
  shadowSmall: '0 4px 12px rgba(123, 67, 85, 0.08)',
  shadowMedium: '0 10px 24px rgba(123, 67, 85, 0.10)',
});

export const BENADEP_RENDER_TOKEN_SOURCES = Object.freeze({
  ink: Object.freeze({ path: COLOR_SOURCE, token: '--brand-ink-900' }),
  heading: Object.freeze({ path: COLOR_SOURCE, token: '--brand-ink-800' }),
  body: Object.freeze({ path: COLOR_SOURCE, token: '--brand-ink-700' }),
  muted: Object.freeze({ path: COLOR_SOURCE, token: '--neutral-60' }),
  neutral: Object.freeze({ path: COLOR_SOURCE, token: '--neutral-10' }),
  softBlush: Object.freeze({ path: COLOR_SOURCE, token: '--secondary' }),
  border: Object.freeze({ path: COLOR_SOURCE, token: '--border' }),
  borderStrong: Object.freeze({
    path: COLOR_SOURCE,
    token: '--brand-border-strong',
  }),
  focus: Object.freeze({ path: COLOR_SOURCE, token: '--ring' }),
  destructive: Object.freeze({ path: COLOR_SOURCE, token: '--destructive' }),
  success: Object.freeze({ path: COLOR_SOURCE, token: '--bena-success' }),
  successLight: Object.freeze({
    path: COLOR_SOURCE,
    token: '--bena-success-light',
  }),
  errorLight: Object.freeze({
    path: COLOR_SOURCE,
    token: '--bena-error-light',
  }),
  warningLight: Object.freeze({
    path: COLOR_SOURCE,
    token: '--bena-warning-light',
  }),
  white: Object.freeze({ path: COLOR_SOURCE, token: '--neutral-0' }),
  shadowSmall: Object.freeze({
    path: '/Users/truongdn/Desktop/benadep/packages/design-system/src/tokens/shadows.css',
    token: '--shadow-sm',
  }),
  shadowMedium: Object.freeze({
    path: '/Users/truongdn/Desktop/benadep/packages/design-system/src/tokens/shadows.css',
    token: '--shadow-md',
  }),
} satisfies Readonly<Record<keyof typeof BENADEP_RENDER_TOKENS, TThemeSource>>);

export interface TNavLink {
  href: string;
  label: string;
}

export const SITE = {
  name: 'AI-First Next.js Boilerplate',
  shortName: 'AI-First',
  locale: 'en_US',
  description:
    'AI-first monorepo boilerplate — type-safe, edge-ready, built for micro-frontends and microservices.',
  ogImage: '/favicon.svg',
} as const;

export const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#stack', label: 'Stack' },
] as const satisfies readonly TNavLink[];

export const SOCIAL_LINKS = {
  github: 'https://github.com/NoahDuongMaster/vibe-code-stack-for-ceos',
} as const;

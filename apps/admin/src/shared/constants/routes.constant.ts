// Single source of truth for admin route paths — no hard-coded URLs in components.
export const ROUTES = {
  DASHBOARD: '/',
  USERS: '/users',
  LOGIN: '/login',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export const SESSION_COOKIE_NAME = 'app-session';

// Keep iron-session's seal lifetime aligned with the browser cookie lifetime.
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

// In-memory auth-token holder. Deliberately NOT a Zustand store: `shared/`
// must never import from `features/`, so this is the neutral seam that lets
// `shared/lib/api-client.ts` read the current token while `features/auth`
// (which owns the actual session state) writes to it on sign-in/sign-out.
let currentToken: string | null = null;

export function setAuthToken(token: string | null): void {
  currentToken = token;
}

export function getAuthToken(): string | null {
  return currentToken;
}

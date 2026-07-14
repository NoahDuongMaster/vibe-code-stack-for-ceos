// In-memory auth-token holder. Deliberately NOT a Zustand store: Shared
// cannot import from Entities, so this neutral seam lets the API client read
// the current token while the Session entity writes it on sign-in/sign-out.
let currentToken: string | null = null;

export function setAuthToken(token: string | null): void {
  currentToken = token;
}

export function getAuthToken(): string | null {
  return currentToken;
}

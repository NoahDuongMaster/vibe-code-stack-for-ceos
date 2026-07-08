// Minimal pub-sub so `shared/lib/api-client.ts` can signal "the current
// session is no longer valid" without importing `features/auth` (shared/
// must never import from features/). `features/auth` subscribes at the app
// root to react by signing out and redirecting to /login.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onUnauthenticated(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitUnauthenticated(): void {
  for (const listener of listeners) listener();
}

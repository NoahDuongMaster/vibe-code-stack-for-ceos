// Server-only barrel — import from Server Components only. Never import this
// from a Client Component (it pulls in `server-only` and will break the build).
import 'server-only';

export { getServerSession } from './services/auth.server.service';

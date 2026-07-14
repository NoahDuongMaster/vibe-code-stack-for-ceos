/**
 * Runtime-independent configuration every api-core consumer supplies. The
 * service runtimes (Node, Cloudflare Workers) provide these values; the domain
 * layer (features/*) stays agnostic of how it's hosted.
 */
export interface ApiConfig {
  /** Identifies the service in Health responses (e.g. 'gateway', 'api-node'). */
  serviceName: string;
  /** Runtime label echoed back to clients (e.g. 'node', 'cloudflare-workers'). */
  runtime: string;
  /** Allowed CORS origins for browser clients. '*' allows any origin. */
  corsOrigins?: string[];
}

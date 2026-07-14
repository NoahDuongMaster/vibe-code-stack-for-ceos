/**
 * Test-only stand-in for the `cloudflare:workers` runtime module, which exists
 * only inside workerd (the production build resolves the real one via
 * @cloudflare/vite-plugin). The Node test suite mocks the RateLimiter binding
 * and never instantiates the Durable Object, so this only needs to be a valid
 * base class for `RateLimiterDO extends DurableObject` to load.
 *
 * Wired in via the `cloudflare:workers` alias in vitest.config.ts.
 */
export class DurableObject {
  constructor(
    protected ctx: unknown,
    protected env: unknown,
  ) {}
}

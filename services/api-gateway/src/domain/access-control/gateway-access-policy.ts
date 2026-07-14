/** Domain policy describing which gateway routes never require access checks. */
export class GatewayAccessPolicy {
  private readonly publicPaths: ReadonlySet<string>;

  constructor(publicPaths: Iterable<string>) {
    this.publicPaths = new Set(publicPaths);
  }

  isPublic(pathname: string): boolean {
    return this.publicPaths.has(pathname);
  }
}

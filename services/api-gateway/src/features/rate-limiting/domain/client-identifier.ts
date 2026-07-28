const UNKNOWN_CLIENT = 'unknown';

/** Value object used as the identity boundary for a client rate-limit bucket. */
export class ClientIdentifier {
  private constructor(readonly value: string) {}

  static fromTrustedHeader(
    value: string | undefined,
    scope = 'global',
  ): ClientIdentifier {
    const normalized = value?.trim();
    return new ClientIdentifier(`${scope}:${normalized || UNKNOWN_CLIENT}`);
  }
}

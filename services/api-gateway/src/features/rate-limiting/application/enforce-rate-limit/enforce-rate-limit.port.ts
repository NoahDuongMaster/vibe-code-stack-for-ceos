export interface EnforceRateLimitCommand {
  pathname: string;
  clientIdentifier: string | undefined;
  requestId: string | undefined;
}

export interface RateLimitEnforcementDecision {
  allowed: boolean;
}

/** Driving port for enforcing the gateway's request budget. */
export interface EnforceRateLimit {
  execute(
    command: EnforceRateLimitCommand,
  ): Promise<RateLimitEnforcementDecision>;
}

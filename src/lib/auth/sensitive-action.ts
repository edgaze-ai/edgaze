import type { ActorMode } from "@lib/auth/actor-context";

export class ImpersonationForbiddenError extends Error {
  readonly status = 403;
  readonly code = "IMPERSONATION_FORBIDDEN";
  constructor(message = "Not allowed during impersonation") {
    super(message);
    this.name = "ImpersonationForbiddenError";
  }
}

/**
 * Hard block for payments, payouts, account security, API keys, etc.
 * Call at the start of sensitive route handlers when actor context is available.
 */
export function assertNotImpersonating(actorMode: ActorMode): void {
  if (actorMode === "admin_impersonation") {
    throw new ImpersonationForbiddenError();
  }
}

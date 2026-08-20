import { isRateLimited } from "./ai/rate-limiter"

/**
 * Per-IP throttling for the public auth endpoints.
 *
 * These were fine unthrottled while they sat behind a browser session, but as
 * public token endpoints they are a credential-stuffing target.
 *
 * Caveat: the underlying bucket store is in-memory, so limits apply per server
 * instance. Behind a multi-instance deployment an attacker gets the limit
 * multiplied by the instance count — still a large reduction, but move this to
 * a shared store (Redis/Upstash) if abuse becomes real.
 */

/** ~10 sign-in attempts per IP per 15 minutes. */
export const AUTH_LOGIN_LIMIT = { maxTokens: 10, refillRatePerSecond: 10 / 900 }

/** ~5 new accounts per IP per hour. */
export const AUTH_REGISTER_LIMIT = { maxTokens: 5, refillRatePerSecond: 5 / 3600 }

/** Refresh is legitimate and frequent, so it gets much more headroom. */
export const AUTH_REFRESH_LIMIT = { maxTokens: 60, refillRatePerSecond: 60 / 3600 }

/** Best-effort client IP. Amplify/CloudFront put the caller first in XFF. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

export function authRateLimited(
  req: Request,
  scope: string,
  config: { maxTokens: number; refillRatePerSecond: number }
): boolean {
  return isRateLimited(`${scope}:${clientIp(req)}`, config)
}

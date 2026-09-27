import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DENIAL_MESSAGES,
  sanitizeCapabilities,
  type Capability,
  type DenialReason,
} from "./capabilities";
import { decide } from "./decide";

/**
 * The entitlement authority.
 *
 * One rule, and the whole commercial boundary rests on it: a premium capability
 * is authorized only by an entitlement this function finds to be ACTIVE, not
 * expired, not revoked, and explicitly listing that capability. Everything else
 * — missing, unknown, pending, inactive, expired, suspended, cancelled — denies.
 *
 * `import "server-only"` above is deliberate. It makes the build fail rather
 * than let this module reach a client bundle, so no browser copy of it can be
 * edited into returning true. Frontend state is presentation; this is the
 * boundary.
 *
 * Callers must use assertCapability at the start of any route or job that
 * spends compute or makes something public. Never cache the answer across
 * requests: an entitlement can be revoked between them.
 */

export type EntitlementDecision =
  | { allowed: true; entitlementId: string; planKey: string }
  | { allowed: false; reason: DenialReason; message: string };

const deny = (reason: DenialReason): EntitlementDecision => ({
  allowed: false,
  reason,
  message: DENIAL_MESSAGES[reason],
});

/**
 * Does this user currently hold `capability`?
 *
 * Reads live on every call. The most specific denial reason wins so the UI can
 * say something useful ("expired" rather than a blanket "no plan").
 */
export async function checkCapability(
  userId: string | null | undefined,
  capability: Capability,
): Promise<EntitlementDecision> {
  if (!userId) return deny("UNAUTHENTICATED");

  const rows = await prisma.entitlement.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  // The rule itself lives in ./decide, pure and unit-tested.
  const decision = decide(rows, capability);
  if (decision.allowed) {
    return { allowed: true, entitlementId: decision.entitlementId, planKey: decision.planKey };
  }
  return deny(decision.reason);
}

/** Thrown by assertCapability. Carries the reason so routes can shape a response. */
export class EntitlementError extends Error {
  readonly reason: DenialReason;
  readonly status: number;
  constructor(decision: Extract<EntitlementDecision, { allowed: false }>) {
    super(decision.message);
    this.name = "EntitlementError";
    this.reason = decision.reason;
    // 401 asks the user to sign in; 402 says the account needs an active plan.
    this.status = decision.reason === "UNAUTHENTICATED" ? 401 : 402;
  }
}

/**
 * Enforce a capability, or throw.
 *
 * Call this at every expensive boundary — when a job is created, when
 * processing starts, and again when something is published. Each is a separate
 * decision: an entitlement may have lapsed since the previous step.
 */
export async function assertCapability(
  userId: string | null | undefined,
  capability: Capability,
): Promise<Extract<EntitlementDecision, { allowed: true }>> {
  const decision = await checkCapability(userId, capability);
  if (!decision.allowed) throw new EntitlementError(decision);
  return decision;
}

/** Capabilities the user currently holds. For rendering locked/unlocked UI only. */
export async function activeCapabilities(
  userId: string | null | undefined,
): Promise<Capability[]> {
  if (!userId) return [];
  const now = new Date();
  const rows = await prisma.entitlement.findMany({
    where: {
      userId,
      revokedAt: null,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
  return [...new Set(rows.flatMap((r) => sanitizeCapabilities(r.capabilities)))];
}

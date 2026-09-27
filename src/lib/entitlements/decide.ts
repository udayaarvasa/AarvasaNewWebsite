/**
 * The entitlement decision rule, isolated and pure.
 *
 * Lives apart from service.ts — which needs Prisma and is server-only — so the
 * rule the whole commercial boundary rests on can be asserted directly by
 * tests, with no database and no network.
 *
 * The rule: authorize only on a row that is ACTIVE, not revoked, not past its
 * expiry, and explicitly listing the capability. Everything else denies.
 */
// Explicit extension so this pure module also loads under plain node for tests;
// the bundler resolves it identically.
import { sanitizeCapabilities, type Capability, type DenialReason } from "./capabilities.ts";

/** The fields of an entitlement the decision actually depends on. */
export type EntitlementRow = {
  readonly id: string;
  readonly planKey: string;
  readonly status: string;
  readonly capabilities: readonly string[];
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
};

export type Decision =
  | { allowed: true; entitlementId: string; planKey: string }
  | { allowed: false; reason: DenialReason };

/** How close the user got, so the message can be specific. */
const RANK: Record<DenialReason, number> = {
  UNAUTHENTICATED: 0,
  NO_ENTITLEMENT: 1,
  INACTIVE: 2,
  SUSPENDED: 3,
  EXPIRED: 4,
  CAPABILITY_NOT_INCLUDED: 5,
};

export function decide(
  rows: readonly EntitlementRow[],
  capability: Capability,
  now: Date = new Date(),
): Decision {
  const live = rows.filter((r) => r.revokedAt === null);
  if (live.length === 0) return { allowed: false, reason: "NO_ENTITLEMENT" };

  let best: DenialReason = "NO_ENTITLEMENT";
  const note = (r: DenialReason) => {
    if (RANK[r] > RANK[best]) best = r;
  };

  for (const row of live) {
    if (row.status === "SUSPENDED") {
      note("SUSPENDED");
      continue;
    }
    if (row.status === "EXPIRED") {
      note("EXPIRED");
      continue;
    }
    // Anything that is not exactly ACTIVE denies — including a status this
    // build has never heard of.
    if (row.status !== "ACTIVE") {
      note("INACTIVE");
      continue;
    }
    // A row still marked ACTIVE past its expiry is expired. The date wins:
    // the status column may not have been swept yet.
    if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) {
      note("EXPIRED");
      continue;
    }
    // Unrecognised names in the stored array grant nothing.
    if (!sanitizeCapabilities([...row.capabilities]).includes(capability)) {
      note("CAPABILITY_NOT_INCLUDED");
      continue;
    }
    return { allowed: true, entitlementId: row.id, planKey: row.planKey };
  }

  return { allowed: false, reason: best };
}

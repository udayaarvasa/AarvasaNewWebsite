import "server-only";

import { prisma } from "@/lib/prisma";
import { sanitizeCapabilities } from "./capabilities";

/**
 * Development / QA entitlement grants.
 *
 * Real payment does not exist yet, so paid features would otherwise be
 * untestable. This is the only way to create an entitlement without a payment,
 * and it is deliberately hard to reach:
 *
 *   - server-side only (`server-only` above keeps it out of client bundles),
 *   - requires an authenticated caller holding the ADMIN role,
 *   - requires AARVASA_ALLOW_TEST_ENTITLEMENTS=1 in the environment,
 *   - refuses outright when NODE_ENV is production,
 *   - records source ADMIN_TEST and the granting admin on every row.
 *
 * There is no URL parameter, no header, no cookie and no localStorage value
 * anywhere in this system that grants access. A browser cannot mint one.
 *
 * Grants are marked ADMIN_TEST for life so a test entitlement can never be
 * mistaken for a paid one in reporting or support.
 */

export const TEST_GRANTS_ENABLED =
  process.env.AARVASA_ALLOW_TEST_ENTITLEMENTS === "1" &&
  process.env.NODE_ENV !== "production";

export const TEST_PLAN_KEY = "test-media-studio";

export type GrantResult =
  | { ok: true; entitlementId: string }
  | { ok: false; error: string };

/** Issue a test entitlement. `grantedBy` must already be a verified admin id. */
export async function grantTestEntitlement(opts: {
  userId: string;
  grantedById: string;
  capabilities: readonly string[];
  expiresAt?: Date | null;
  note?: string;
}): Promise<GrantResult> {
  if (!TEST_GRANTS_ENABLED) {
    return { ok: false, error: "Test entitlements are not enabled in this environment." };
  }
  const capabilities = sanitizeCapabilities(opts.capabilities);
  if (capabilities.length === 0) {
    return { ok: false, error: "No recognised capabilities were requested." };
  }

  const row = await prisma.entitlement.create({
    data: {
      userId: opts.userId,
      planKey: TEST_PLAN_KEY,
      capabilities,
      status: "ACTIVE",
      activatedAt: new Date(),
      expiresAt: opts.expiresAt ?? null,
      source: "ADMIN_TEST",
      grantedById: opts.grantedById,
      note: opts.note ?? "Issued for development/QA. Not a paid entitlement.",
    },
    select: { id: true },
  });
  return { ok: true, entitlementId: row.id };
}

/** Revoke a test entitlement. Revocation is immediate — checks read live. */
export async function revokeTestEntitlement(
  entitlementId: string,
): Promise<GrantResult> {
  if (!TEST_GRANTS_ENABLED) {
    return { ok: false, error: "Test entitlements are not enabled in this environment." };
  }
  const row = await prisma.entitlement.findUnique({
    where: { id: entitlementId },
    select: { id: true, source: true },
  });
  if (!row) return { ok: false, error: "No such entitlement." };
  // Never let the test path revoke something a customer paid for.
  if (row.source !== "ADMIN_TEST") {
    return { ok: false, error: "That entitlement was not issued as a test grant." };
  }
  await prisma.entitlement.update({
    where: { id: entitlementId },
    data: { status: "INACTIVE", revokedAt: new Date() },
  });
  return { ok: true, entitlementId: row.id };
}

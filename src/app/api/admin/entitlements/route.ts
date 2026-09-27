import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth-context";
import {
  TEST_GRANTS_ENABLED,
  grantTestEntitlement,
  revokeTestEntitlement,
} from "@/lib/entitlements/test-grant";
import { ENTITLEMENT_CAPABILITIES } from "@/lib/entitlements/capabilities";

/**
 * Admin-only test entitlement grants, for QA while payment does not exist.
 *
 * Three conditions, all server-side, all required:
 *   - AARVASA_ALLOW_TEST_ENTITLEMENTS=1 and NODE_ENV is not production,
 *   - the caller holds ADMIN on their verified session,
 *   - the capabilities requested are recognised names.
 *
 * When the flag is off the route reports 404, not 403: in production this
 * endpoint should not appear to exist at all.
 */
const GrantSchema = z.object({
  userId: z.string().min(1).max(64),
  capabilities: z.array(z.enum(ENTITLEMENT_CAPABILITIES)).min(1),
  expiresInHours: z.number().int().positive().max(24 * 30).optional(),
  note: z.string().max(200).optional(),
});

const RevokeSchema = z.object({ entitlementId: z.string().min(1).max(64) });

const hidden = () =>
  NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

async function requireAdmin(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return null;
  return user.role === "ADMIN" ? user : null;
}

export async function POST(req: Request) {
  if (!TEST_GRANTS_ENABLED) return hidden();
  const admin = await requireAdmin(req);
  if (!admin) return hidden();

  const parsed = GrantSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid grant request" }, { status: 400 });
  }

  const { userId, capabilities, expiresInHours, note } = parsed.data;
  const result = await grantTestEntitlement({
    userId,
    grantedById: admin.id,
    capabilities,
    expiresAt: expiresInHours
      ? new Date(Date.now() + expiresInHours * 3600_000)
      : null,
    note,
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json(
    {
      success: true,
      entitlementId: result.entitlementId,
      // Stated on every response so a test grant is never mistaken for a sale.
      notice: "Test entitlement. No payment was taken.",
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(req: Request) {
  if (!TEST_GRANTS_ENABLED) return hidden();
  const admin = await requireAdmin(req);
  if (!admin) return hidden();

  const parsed = RevokeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid revoke request" }, { status: 400 });
  }

  const result = await revokeTestEntitlement(parsed.data.entitlementId);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}

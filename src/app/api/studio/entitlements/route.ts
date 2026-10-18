import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-context";
import { activeCapabilities } from "@/lib/entitlements/service";
import { paymentsAvailable } from "@/lib/entitlements/payment-provider";
import { mediaFeaturesResponse } from "@/lib/media-features";

/**
 * GET /api/studio/entitlements — what the signed-in user may currently do.
 *
 * Presentation only. The Media Studio uses this to decide which panels render
 * unlocked; it is not the security boundary and nothing is authorized by it.
 * Every premium operation re-checks server-side at its own endpoint, so a user
 * who forges this response gains exactly nothing.
 */
export async function GET(req: Request) {
  const gated = mediaFeaturesResponse();
  if (gated) return gated;

  const user = await getAuthUser(req);
  const capabilities = await activeCapabilities(user?.id);

  return NextResponse.json(
    {
      success: true,
      signedIn: Boolean(user),
      capabilities,
      // Honest about the commercial state: there is no checkout to send anyone to.
      checkoutAvailable: paymentsAvailable(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

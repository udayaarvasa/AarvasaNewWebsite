import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-context";
import { requireCapability } from "@/lib/entitlements/route-guard";
import { mediaFeaturesResponse } from "@/lib/media-features";

/**
 * POST /api/studio/publish — make a creator-generated immersive asset public.
 *
 * Two independent gates, both server-side:
 *
 *  1. Entitlement. Publishing is a premium capability, re-checked here rather
 *     than inherited from whatever was true when the asset was uploaded.
 *  2. Ownership. Holding a plan does not grant access to someone else's media,
 *     so the asset's uploader is compared against the verified session. The
 *     browser never supplies the owner.
 *
 * A caller who owns nothing is told the asset was not found rather than that it
 * exists but belongs to someone else.
 */
const BodySchema = z.object({ mediaAssetId: z.string().min(1).max(64) });

export async function POST(req: Request) {
  const gated = mediaFeaturesResponse();
  if (gated) return gated;

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const guard = await requireCapability(req, "PUBLISH_IMMERSIVE");
  if (!guard.ok) return guard.response;

  const user = await getAuthUser(req);
  const asset = await prisma.mediaAsset
    .findUnique({
      where: { id: parsed.data.mediaAssetId },
      select: { id: true, uploadedById: true, status: true },
    })
    .catch(() => null);

  // Not found and not yours are the same answer: existence is not disclosed.
  const owns = asset && user && asset.uploadedById === user.id;
  if (!asset || (!owns && user?.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Only a reviewed asset may go public; the review step is not bypassable here.
  if (asset.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      {
        success: false,
        error: "This asset is not ready to publish.",
        reason: "NOT_REVIEWABLE",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: "Publishing creator media is not available yet.",
      reason: "PUBLISH_UNAVAILABLE",
    },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}

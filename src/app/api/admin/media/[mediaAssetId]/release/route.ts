import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { releaseReviewAsset } from "@/lib/services/media-review.service"
import { mediaReviewRouteDeps, NO_STORE } from "@/lib/services/media-review.route-deps"
import { mediaFeaturesResponse } from "@/lib/media-features";

type Params = { params: Promise<{ mediaAssetId: string }> }

/*
 * POST /api/admin/media/{mediaAssetId}/release — PUBLISHED+INTERNAL → PUBLIC.
 *
 * Its own endpoint rather than a flag on approval, because it is a different
 * decision made at a different time: approval says the asset is correct,
 * release says the organisation will show it to buyers. The asset is named by
 * the path only — there is no body and no query string, so there is nothing a
 * client can set to influence which asset moves or what it moves to.
 *
 * Admin only, re-read from the database on every request by the service.
 */
export async function POST(req: Request, { params }: Params) {
  const gated = mediaFeaturesResponse();
  if (gated) return gated;

  try {
    const { mediaAssetId } = await params
    const result = await releaseReviewAsset(
      { caller: await getAuthUser(req), mediaAssetId, contentType: req.headers.get("content-type"), readBody: () => req.json() },
      mediaReviewRouteDeps("POST /api/admin/media/[mediaAssetId]/release"),
    )
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE })
  } catch (err) {
    console.error("[POST /api/admin/media/[mediaAssetId]/release]", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ success: false, error: "Server error", code: "SERVER_ERROR", retryable: true }, { status: 500, headers: NO_STORE })
  }
}

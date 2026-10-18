import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { rejectReviewAsset } from "@/lib/services/media-review.service"
import { mediaReviewRouteDeps, NO_STORE } from "@/lib/services/media-review.route-deps"
import { mediaFeaturesResponse } from "@/lib/media-features";

type Params = { params: Promise<{ mediaAssetId: string }> }

// POST /api/admin/media/{mediaAssetId}/reject — reject → REJECTED (admin only)
export async function POST(req: Request, { params }: Params) {
  const gated = mediaFeaturesResponse();
  if (gated) return gated;

  try {
    const { mediaAssetId } = await params
    const result = await rejectReviewAsset(
      { caller: await getAuthUser(req), mediaAssetId, contentType: req.headers.get("content-type"), readBody: () => req.json() },
      mediaReviewRouteDeps("POST /api/admin/media/[mediaAssetId]/reject")
    )
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE })
  } catch (err) {
    console.error("[POST /api/admin/media/[mediaAssetId]/reject]", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ success: false, error: "Server error", code: "SERVER_ERROR", retryable: true }, { status: 500, headers: NO_STORE })
  }
}

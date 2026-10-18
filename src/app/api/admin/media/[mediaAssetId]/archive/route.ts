import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { archiveReviewAsset } from "@/lib/services/media-review.service"
import { mediaReviewRouteDeps, NO_STORE } from "@/lib/services/media-review.route-deps"
import { mediaFeaturesResponse } from "@/lib/media-features";

type Params = { params: Promise<{ mediaAssetId: string }> }

/**
 * POST /api/admin/media/{mediaAssetId}/archive — withdraw an asset (admin only).
 *
 * The only way back out of PUBLISHED. Body: { reason }. It changes the record,
 * not the bucket: see archiveReviewAsset for why the application does not hold
 * delete rights over write-once storage.
 */
export async function POST(req: Request, { params }: Params) {
  const gated = mediaFeaturesResponse();
  if (gated) return gated;

  try {
    const { mediaAssetId } = await params
    const result = await archiveReviewAsset(
      { caller: await getAuthUser(req), mediaAssetId, contentType: req.headers.get("content-type"), readBody: () => req.json() },
      mediaReviewRouteDeps("POST /api/admin/media/[mediaAssetId]/archive")
    )
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE })
  } catch (err) {
    console.error("[POST /api/admin/media/[mediaAssetId]/archive]", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ success: false, error: "Server error", code: "SERVER_ERROR", retryable: true }, { status: 500, headers: NO_STORE })
  }
}

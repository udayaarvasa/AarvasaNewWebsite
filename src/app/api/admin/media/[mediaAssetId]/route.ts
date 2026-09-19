import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { getReviewAsset } from "@/lib/services/media-review.service"
import { mediaReviewRouteDeps, NO_STORE } from "@/lib/services/media-review.route-deps"

type Params = { params: Promise<{ mediaAssetId: string }> }

// GET /api/admin/media/{mediaAssetId} — one asset, with processing status and diagnostics (admin only)
export async function GET(req: Request, { params }: Params) {
  try {
    const { mediaAssetId } = await params
    const result = await getReviewAsset({ caller: await getAuthUser(req), mediaAssetId }, mediaReviewRouteDeps("GET /api/admin/media/[mediaAssetId]"))
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE })
  } catch (err) {
    console.error("[GET /api/admin/media/[mediaAssetId]]", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ success: false, error: "Server error", code: "SERVER_ERROR", retryable: true }, { status: 500, headers: NO_STORE })
  }
}

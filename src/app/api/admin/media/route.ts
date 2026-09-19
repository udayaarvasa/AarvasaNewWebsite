import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { listReviewAssets } from "@/lib/services/media-review.service"
import { mediaReviewRouteDeps, NO_STORE } from "@/lib/services/media-review.route-deps"

// GET /api/admin/media?status=PENDING_REVIEW&limit=50 — admin media list (Phase 5)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const result = await listReviewAssets(
      { caller: await getAuthUser(req), status: url.searchParams.get("status"), limit: url.searchParams.get("limit") },
      mediaReviewRouteDeps("GET /api/admin/media")
    )
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE })
  } catch (err) {
    console.error("[GET /api/admin/media]", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ success: false, error: "Server error", code: "SERVER_ERROR", retryable: true }, { status: 500, headers: NO_STORE })
  }
}

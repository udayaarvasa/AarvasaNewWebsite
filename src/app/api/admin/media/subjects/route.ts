import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { prisma } from "@/lib/prisma"
import { projects } from "@/lib/projects"
import { requireReviewAdmin } from "@/lib/services/media-review.service"
import { mediaReviewRouteDeps, NO_STORE } from "@/lib/services/media-review.route-deps"
import { mediaFeaturesResponse } from "@/lib/media-features";

// GET /api/admin/media/subjects — what an admin may attach immersive media to:
// properties (most recent 200) and every defined project (admin only).
export async function GET(req: Request) {
  const gated = mediaFeaturesResponse();
  if (gated) return gated;

  try {
    const admin = await requireReviewAdmin({ caller: await getAuthUser(req) }, mediaReviewRouteDeps("GET /api/admin/media/subjects"))
    if ("error" in admin) return NextResponse.json(admin.error.body, { status: admin.error.status, headers: NO_STORE })
    const properties = await prisma.property.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, city: true },
    })
    return NextResponse.json(
      {
        success: true,
        data: { properties, projects: projects.map((p) => ({ slug: p.slug, name: p.name, published: p.published })) },
      },
      { headers: NO_STORE }
    )
  } catch (err) {
    console.error("[GET /api/admin/media/subjects]", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ success: false, error: "Server error", code: "SERVER_ERROR", retryable: true }, { status: 500, headers: NO_STORE })
  }
}

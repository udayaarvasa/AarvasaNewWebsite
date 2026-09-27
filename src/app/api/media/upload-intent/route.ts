import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { requireCapability } from "@/lib/entitlements/route-guard"
import { getIngestUploadSigner } from "@/lib/media/ingest-storage"
import { getProject } from "@/lib/projects"
import { handleUploadIntent, randomUploadIdentifier } from "@/lib/services/media-upload.service"
import { prismaUploadIntentStore } from "@/lib/services/media-upload.store"

// POST /api/media/upload-intent — authorise one direct upload of an immersive media
// source to the ingest bucket (Phase 5A). See lib/services/media-upload.service.ts.
export async function POST(req: Request) {
  try {
    // Entitlement first: a presigned upload URL commits Aarvasa to storing and
    // then processing someone's media, so it is checked before any work — and
    // before the signer is touched. Checked again when processing starts and
    // when the asset is published; an entitlement can lapse between steps.
    const guard = await requireCapability(req, "PROCESS_MEDIA")
    if (!guard.ok) return guard.response

    const result = await handleUploadIntent(
      {
        caller: await getAuthUser(req),
        contentType: req.headers.get("content-type"),
        contentLength: req.headers.has("content-length") ? Number(req.headers.get("content-length")) : null,
        readBody: () => req.json(),
      },
      {
        store: prismaUploadIntentStore,
        getSigner: () => getIngestUploadSigner(),
        findProject: (slug) => {
          const project = getProject(slug)
          return project ? { slug: project.slug, published: project.published } : null
        },
        now: () => new Date(),
        randomId: randomUploadIdentifier,
        log: (message, context) => console.error(`[POST /api/media/upload-intent] ${message}`, context),
      }
    )
    // Presigned URLs must never be cached by the browser or an intermediary.
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[POST /api/media/upload-intent]", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}

import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { getIngestObjectInspector } from "@/lib/media/ingest-storage"
import { getProcessingJobQueue } from "@/lib/media/processing-queue"
import { getProject } from "@/lib/projects"
import { handleUploadCompletion } from "@/lib/services/media-completion.service"
import { prismaUploadCompletionStore } from "@/lib/services/media-completion.store"

type Params = { params: Promise<{ mediaAssetId: string }> }

// POST /api/media/{mediaAssetId}/complete — verify an uploaded source in the ingest
// bucket and hand the asset to processing (Phase 5B). Body: {}. See
// lib/services/media-completion.service.ts.
export async function POST(req: Request, { params }: Params) {
  const queue = getProcessingJobQueue()
  const dispatch = queue ? (job: Parameters<typeof queue.send>[0]) => queue.send(job) : undefined
  try {
    const { mediaAssetId } = await params
    const result = await handleUploadCompletion(
      {
        caller: await getAuthUser(req),
        mediaAssetId,
        contentType: req.headers.get("content-type"),
        contentLength: req.headers.has("content-length") ? Number(req.headers.get("content-length")) : null,
        readBody: () => req.json(),
      },
      {
        store: prismaUploadCompletionStore,
        getInspector: () => getIngestObjectInspector(),
        projectExists: (slug) => getProject(slug) !== undefined,
        now: () => new Date(),
        log: (message, context) => console.error(`[POST /api/media/[mediaAssetId]/complete] ${message}`, context),
        // Sent only after UPLOADED → PROCESSING commits; without a configured queue the sweeper re-sends.
        dispatchProcessing: dispatch,
        newJobId: randomUUID,
      }
    )
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[POST /api/media/[mediaAssetId]/complete]", err instanceof Error ? err.name : "UnknownError")
    return NextResponse.json(
      { success: false, error: "Server error", code: "SERVER_ERROR", retryable: true },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
